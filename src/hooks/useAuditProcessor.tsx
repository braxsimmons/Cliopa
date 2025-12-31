import { useState, useEffect } from "react";
import { ReportCardsInsert } from "@/services/ReportCardsService";
import { useToast } from "@/hooks/use-toast";
import {
  runAudit,
  checkProviderAvailability,
  getDefaultAIProvider,
  getGeminiProvider,
  getOllamaProvider,
  testGeminiConnection,
  type AIAuditResult,
  type CriterionResult,
} from "@/services/AIAuditService";

// Extended result type that includes legacy fields for UI compatibility
interface AuditResult {
  overall_score: number;
  summary: string;
  criteria: CriterionResult[];
  communication_score?: number;
  compliance_score?: number;
  accuracy_score?: number;
  tone_score?: number;
  empathy_score?: number;
  resolution_score?: number;
  recommendations?: string[];
  fromCache?: boolean;
}

type AIProviderType = 'lmstudio' | 'gemini' | 'ollama';

export const useAuditProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('lmstudio');
  const [providerStatus, setProviderStatus] = useState<Record<AIProviderType, boolean | null>>({
    lmstudio: null,
    gemini: null,
    ollama: null,
  });
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const { toast } = useToast();

  // Legacy compatibility
  const useLocalLLM = selectedProvider === 'lmstudio';
  const setUseLocalLLM = (value: boolean) => {
    setSelectedProvider(value ? 'lmstudio' : 'gemini');
  };
  const lmStudioAvailable = providerStatus.lmstudio;

  const checkProviderStatus = async (provider: AIProviderType): Promise<boolean> => {
    try {
      let available = false;
      if (provider === 'lmstudio') {
        available = await checkProviderAvailability(getDefaultAIProvider());
      } else if (provider === 'gemini' && geminiApiKey) {
        const result = await testGeminiConnection(geminiApiKey);
        available = result.success;
      } else if (provider === 'ollama') {
        available = await checkProviderAvailability(getOllamaProvider());
      }
      setProviderStatus(prev => ({ ...prev, [provider]: available }));
      return available;
    } catch {
      setProviderStatus(prev => ({ ...prev, [provider]: false }));
      return false;
    }
  };

  const checkLMStudioAvailability = async (): Promise<boolean> => {
    const available = await checkProviderStatus('lmstudio');
    if (!available) {
      toast({
        title: "LM Studio Not Available",
        description: "Start LM Studio on port 1234 for local processing, or configure Gemini API.",
        variant: "default",
      });
    }
    return available;
  };

  // Check LM Studio availability on mount
  useEffect(() => {
    checkProviderStatus('lmstudio');
  }, []);

  // Check Gemini when API key changes
  useEffect(() => {
    if (geminiApiKey) {
      checkProviderStatus('gemini');
    }
  }, [geminiApiKey]);

  const processAudit = async (
    transcriptText: string,
    userId: string,
    sourceFile: string = "manual_upload"
  ): Promise<AuditResult | null> => {
    setProcessing(true);
    setResult(null);

    const startTime = Date.now();

    try {
      // Determine which provider to use
      let effectiveProvider: AIProviderType = selectedProvider;

      // Check if selected provider is available
      const isAvailable = await checkProviderStatus(selectedProvider);
      if (!isAvailable) {
        // Try fallback providers
        if (selectedProvider === 'lmstudio') {
          if (geminiApiKey && await checkProviderStatus('gemini')) {
            effectiveProvider = 'gemini';
            toast({
              title: "Using Gemini",
              description: "LM Studio unavailable, using Gemini API...",
            });
          } else {
            throw new Error("No AI provider available. Start LM Studio or configure Gemini API key.");
          }
        } else {
          throw new Error(`${selectedProvider} is not available.`);
        }
      }

      toast({
        title: `Processing with ${effectiveProvider === 'lmstudio' ? 'LM Studio' : effectiveProvider === 'gemini' ? 'Gemini' : 'Ollama'}`,
        description: "Analyzing call transcript...",
      });

      // Use the new AIAuditService
      const auditResult = await runAudit(transcriptText, {
        geminiApiKey: effectiveProvider === 'gemini' ? geminiApiKey : undefined,
        preferredProvider: effectiveProvider,
      });

      const processingTime = auditResult.processing_time_ms || (Date.now() - startTime);

      // Convert to legacy format for UI compatibility
      const legacyResult: AuditResult = {
        overall_score: auditResult.overall_score,
        summary: auditResult.feedback,
        criteria: auditResult.criteria_results,
        communication_score: auditResult.communication_score,
        compliance_score: auditResult.compliance_score,
        accuracy_score: auditResult.accuracy_score,
        tone_score: auditResult.tone_score,
        empathy_score: auditResult.empathy_score,
        resolution_score: auditResult.resolution_score,
        recommendations: auditResult.recommendations,
        fromCache: auditResult.fromCache,
      };

      setResult(legacyResult);

      // Save to database
      const { reportCard, error } = await ReportCardsInsert({
        user_id: userId,
        source_file: sourceFile,
        source_type: "manual_upload",
        overall_score: auditResult.overall_score,
        communication_score: auditResult.communication_score,
        compliance_score: auditResult.compliance_score,
        accuracy_score: auditResult.accuracy_score,
        tone_score: auditResult.tone_score,
        empathy_score: auditResult.empathy_score,
        resolution_score: auditResult.resolution_score,
        feedback: auditResult.feedback,
        strengths: auditResult.strengths,
        areas_for_improvement: auditResult.areas_for_improvement,
        recommendations: auditResult.recommendations,
        criteria_results: auditResult.criteria_results,
        ai_model: auditResult.ai_model,
        ai_provider: auditResult.ai_provider,
        processing_time_ms: processingTime,
      });

      if (error) {
        console.error("Error saving report card:", error);
        toast({
          title: "Warning",
          description: "Audit completed but failed to save to database",
          variant: "destructive",
        });
      } else {
        const cacheNote = auditResult.fromCache ? ' (cached)' : '';
        toast({
          title: `Audit Complete${cacheNote} (${(processingTime / 1000).toFixed(1)}s)`,
          description: `Overall score: ${auditResult.overall_score}/100 via ${auditResult.ai_provider}`,
        });
      }

      return legacyResult;
    } catch (error) {
      console.error("Audit processing error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process audit",
        variant: "destructive",
      });
      return null;
    } finally {
      setProcessing(false);
    }
  };

  return {
    processAudit,
    processing,
    result,
    // Legacy compatibility
    useLocalLLM,
    setUseLocalLLM,
    lmStudioAvailable,
    checkLMStudioAvailability,
    // New provider management
    selectedProvider,
    setSelectedProvider,
    providerStatus,
    checkProviderStatus,
    geminiApiKey,
    setGeminiApiKey,
  };
};
