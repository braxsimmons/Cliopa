import { useState, useEffect } from "react";
import { ReportCardsInsert } from "@/services/ReportCardsService";
import { useToast } from "@/hooks/use-toast";
import { lmStudioClient, type AuditResult } from "@/lib/lmStudioClient";

interface AuditCriterion {
  id: string;
  result: "PASS" | "PARTIAL" | "FAIL";
  explanation: string;
  recommendation: string;
}

export const useAuditProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [useLocalLLM, setUseLocalLLM] = useState(true); // Default to LM Studio
  const [lmStudioAvailable, setLmStudioAvailable] = useState<boolean | null>(null);
  const { toast } = useToast();

  const checkLMStudioAvailability = async () => {
    const available = await lmStudioClient.checkAvailability();
    setLmStudioAvailable(available);
    if (!available) {
      toast({
        title: "LM Studio Not Available",
        description: "Falling back to OpenAI. Start LM Studio on port 1234 for local processing.",
        variant: "default",
      });
    }
    return available;
  };

  // Check LM Studio availability on mount
  useEffect(() => {
    checkLMStudioAvailability();
  }, []);

  const processAudit = async (
    transcriptText: string,
    userId: string,
    sourceFile: string = "manual_upload"
  ): Promise<AuditResult | null> => {
    setProcessing(true);
    setResult(null);

    const startTime = Date.now();

    try {
      let auditResult: AuditResult;
      let aiProvider: string;
      let aiModel: string;

      // Try LM Studio first if enabled
      if (useLocalLLM) {
        const isAvailable = await checkLMStudioAvailability();

        if (isAvailable) {
          toast({
            title: "Processing with LM Studio",
            description: "Using local LLM for real-time audit...",
          });

          auditResult = (await lmStudioClient.processAudit(transcriptText))!;
          aiProvider = "lm-studio";
          aiModel = "local-model";
        } else {
          // Fallback to OpenAI
          toast({
            title: "LM Studio Unavailable",
            description: "Falling back to OpenAI API...",
            variant: "default",
          });
          auditResult = await processWithOpenAI(transcriptText, sourceFile);
          aiProvider = "openai";
          aiModel = "gpt-4o-mini";
        }
      } else {
        // Use OpenAI directly
        auditResult = await processWithOpenAI(transcriptText, sourceFile);
        aiProvider = "openai";
        aiModel = "gpt-4o-mini";
      }

      const processingTime = Date.now() - startTime;
      setResult(auditResult);

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
        feedback: auditResult.summary,
        strengths: extractStrengths(auditResult.criteria),
        areas_for_improvement: extractImprovements(auditResult.criteria),
        recommendations: extractRecommendations(auditResult.criteria),
        criteria_results: auditResult.criteria,
        ai_model: aiModel,
        ai_provider: aiProvider,
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
        toast({
          title: `Audit Complete (${(processingTime / 1000).toFixed(1)}s)`,
          description: `Overall score: ${auditResult.overall_score}/100 via ${aiProvider}`,
        });
      }

      return auditResult;
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

  // Fallback: Process with OpenAI
  const processWithOpenAI = async (
    transcriptText: string,
    sourceFile: string
  ): Promise<AuditResult> => {
    // This would call your OpenAI API
    // For now, return mock data or implement OpenAI client
    throw new Error("OpenAI processing not yet implemented. Please use LM Studio.");
  };

  const extractStrengths = (criteria: AuditCriterion[]): string[] => {
    return criteria
      .filter((c) => c.result === "PASS")
      .map((c) => c.explanation)
      .slice(0, 5);
  };

  const extractImprovements = (criteria: AuditCriterion[]): string[] => {
    return criteria
      .filter((c) => c.result === "FAIL" || c.result === "PARTIAL")
      .map((c) => c.explanation)
      .slice(0, 5);
  };

  const extractRecommendations = (criteria: AuditCriterion[]): string[] => {
    return criteria
      .filter((c) => c.result === "FAIL" || c.result === "PARTIAL")
      .map((c) => c.recommendation)
      .filter((r) => r && r.length > 0)
      .slice(0, 5);
  };

  return {
    processAudit,
    processing,
    result,
    useLocalLLM,
    setUseLocalLLM,
    lmStudioAvailable,
    checkLMStudioAvailability,
  };
};
