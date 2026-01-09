/**
 * Call Ingestion Service
 *
 * Handles importing calls directly without Five9 dependency.
 * Supports manual upload, bulk import, and transcript processing.
 * Now includes speaker diarization for Agent/Customer identification.
 */

import { supabase } from "@/integrations/supabase/client";
import { addSpeakerLabels, hasSpeekerLabels } from "./TranscriptionService";
import {
  performAudit,
  getGeminiProvider,
  getOllamaProvider,
  getDefaultAIProvider,
  AIProvider,
} from "./AIAuditService";

export interface CallImportData {
  // Required fields
  userId: string;
  transcriptText: string;

  // Optional metadata
  callStartTime?: string;
  callEndTime?: string;
  callDurationSeconds?: number;
  callType?: 'inbound' | 'outbound' | 'internal';
  campaignName?: string;
  customerPhone?: string;
  customerName?: string;
  disposition?: string;
  recordingUrl?: string;
  sourceFile?: string;
}

export interface BulkImportRow {
  agent_email: string;
  transcript: string;
  call_date?: string;
  call_duration_seconds?: number;
  call_type?: string;
  campaign?: string;
  customer_phone?: string;
  customer_name?: string;
  disposition?: string;
}

export interface ImportResult {
  success: boolean;
  callId?: string;
  error?: string;
}

export interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  results: ImportResult[];
}

class CallIngestionService {
  /**
   * Import a single call with transcript
   */
  async importCall(data: CallImportData): Promise<ImportResult> {
    try {
      // Calculate duration if not provided but times are
      let duration = data.callDurationSeconds;
      if (!duration && data.callStartTime && data.callEndTime) {
        duration = Math.floor(
          (new Date(data.callEndTime).getTime() - new Date(data.callStartTime).getTime()) / 1000
        );
      }

      // Add speaker labels if not present
      let processedTranscript = data.transcriptText;
      if (!hasSpeekerLabels(processedTranscript)) {
        console.log("Transcript missing speaker labels, adding them via AI...");
        try {
          // Get AI settings for endpoint (key-value format)
          const { data: settingsRow } = await supabase
            .from("company_settings")
            .select("setting_key, setting_value")
            .eq("setting_key", "ai_settings")
            .single();

          const settingsVal = settingsRow?.setting_value;
          const aiSettings = settingsVal
            ? (typeof settingsVal === 'string' ? JSON.parse(settingsVal) : settingsVal)
            : {};

          // Require explicit host configuration - no localhost fallback
          if (!aiSettings.host) {
            throw new Error('AI host not configured. Please configure AI settings.');
          }
          const endpoint = `${aiSettings.host}/v1/chat/completions`;

          processedTranscript = await addSpeakerLabels(
            processedTranscript,
            endpoint,
            aiSettings.model || 'local-model'
          );
          console.log("Speaker labels added successfully");
        } catch (labelError) {
          console.warn("Could not add speaker labels:", labelError);
          // Continue with original transcript
        }
      }

      // Insert call record
      const { data: call, error: insertError } = await supabase
        .from("calls")
        .insert({
          user_id: data.userId,
          call_type: data.callType || 'inbound',
          call_start_time: data.callStartTime || new Date().toISOString(),
          call_end_time: data.callEndTime,
          call_duration_seconds: duration,
          campaign_name: data.campaignName,
          recording_url: data.recordingUrl,
          transcript_text: processedTranscript,
          customer_phone: data.customerPhone,
          customer_name: data.customerName,
          disposition: data.disposition,
          source_file: data.sourceFile,
          status: 'transcribed', // Already has transcript
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error inserting call:", insertError);
        return { success: false, error: insertError.message };
      }

      // Trigger AI audit (now returns success/error info)
      const auditResult = await this.triggerAudit(call.id);
      if (!auditResult.success) {
        console.warn(`Call imported but audit failed: ${auditResult.error}`);
        // Don't fail the import, just log the warning
      }

      // Trigger conversation analysis (for sentiment, topics, etc.)
      await this.triggerConversationAnalysis(call.id);

      return { success: true, callId: call.id };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Import error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Import multiple calls from CSV data
   */
  async bulkImport(rows: BulkImportRow[]): Promise<BulkImportResult> {
    const results: ImportResult[] = [];
    let successful = 0;
    let failed = 0;

    for (const row of rows) {
      // Look up user by email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", row.agent_email)
        .single();

      if (!profile) {
        results.push({
          success: false,
          error: `Agent not found: ${row.agent_email}`
        });
        failed++;
        continue;
      }

      const result = await this.importCall({
        userId: profile.id,
        transcriptText: row.transcript,
        callStartTime: row.call_date,
        callDurationSeconds: row.call_duration_seconds,
        callType: (row.call_type?.toLowerCase() as 'inbound' | 'outbound' | 'internal') || 'inbound',
        campaignName: row.campaign,
        customerPhone: row.customer_phone,
        customerName: row.customer_name,
        disposition: row.disposition,
      });

      results.push(result);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return {
      total: rows.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Parse CSV content into import rows
   */
  parseCSV(csvContent: string): BulkImportRow[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows: BulkImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim();
      });

      // Map common column name variations
      rows.push({
        agent_email: row.agent_email || row.email || row.agent,
        transcript: row.transcript || row.transcript_text || row.call_transcript,
        call_date: row.call_date || row.date || row.call_start_time,
        call_duration_seconds: parseInt(row.call_duration_seconds || row.duration || row.call_duration) || undefined,
        call_type: row.call_type || row.type,
        campaign: row.campaign || row.campaign_name,
        customer_phone: row.customer_phone || row.phone,
        customer_name: row.customer_name || row.customer,
        disposition: row.disposition || row.outcome,
      });
    }

    return rows.filter(r => r.agent_email && r.transcript);
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    return values;
  }

  /**
   * Trigger AI audit for a call using centralized AIAuditService
   * Now includes proper error handling, retries, and score validation
   */
  async triggerAudit(callId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get call data
      const { data: call, error: callError } = await supabase
        .from("calls")
        .select("*, profiles:user_id(id, full_name, email)")
        .eq("id", callId)
        .single();

      if (callError || !call) {
        const error = `Failed to fetch call: ${callError?.message || 'Call not found'}`;
        console.error(error);
        return { success: false, error };
      }

      if (!call.transcript_text) {
        console.log("No transcript available for audit");
        return { success: false, error: 'No transcript available' };
      }

      // Check if call already has a report card (prevent duplicates)
      const { data: existingCard } = await supabase
        .from("report_cards")
        .select("id")
        .eq("call_id", callId)
        .single();

      if (existingCard) {
        console.log("Call already has a report card, skipping audit");
        return { success: true }; // Not an error, just already done
      }

      // Get default audit template
      const { data: template } = await supabase
        .from("audit_templates")
        .select("*")
        .eq("is_default", true)
        .single();

      // Get AI settings from company_settings (key-value format)
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "ai_settings")
        .single();

      const settingsValue = companySettings?.setting_value;
      const settings = settingsValue
        ? (typeof settingsValue === 'string' ? JSON.parse(settingsValue) : settingsValue)
        : {
            provider: 'gemini',
            host: 'https://generativelanguage.googleapis.com',
            model: 'gemini-2.0-flash',
            apiKey: '',
          };

      // Build AI provider based on settings
      let aiProvider: AIProvider;
      switch (settings.provider) {
        case 'gemini':
          if (!settings.apiKey) {
            return { success: false, error: 'Gemini API key not configured. Go to AI Settings to set it up.' };
          }
          aiProvider = getGeminiProvider(settings.apiKey, settings.model || 'gemini-2.0-flash');
          break;
        case 'ollama':
          if (!settings.host) {
            return { success: false, error: 'Ollama host not configured. Go to AI Settings to set it up.' };
          }
          aiProvider = getOllamaProvider(settings.host, settings.model || 'llama3.1:8b');
          break;
        default:
          // Default to Gemini
          aiProvider = getDefaultAIProvider();
      }

      console.log(`Auditing call ${callId} with ${aiProvider.name}/${aiProvider.model}...`);

      // Perform audit using centralized service (has retries, validation, etc.)
      const auditResult = await performAudit(
        call.transcript_text,
        aiProvider,
        template?.criteria || this.getDefaultCriteria(),
        {
          callDurationSeconds: call.call_duration_seconds,
          campaignName: call.campaign_name,
          callType: call.call_type,
        }
      );

      // Handle non-scorable calls (voicemails, hangups, etc.)
      if (!auditResult.scorable) {
        console.log(`Call ${callId} is ${auditResult.callType.callType} - not scorable`);

        // Still create a report card but with explanation
        await supabase.from("report_cards").insert({
          user_id: call.user_id,
          call_id: callId,
          source_file: call.source_file || `call-${callId}`,
          source_type: 'call',
          overall_score: 0,
          communication_score: 0,
          compliance_score: 0,
          accuracy_score: 0,
          tone_score: 0,
          empathy_score: 0,
          resolution_score: 0,
          feedback: auditResult.explanation || `This call was identified as a ${auditResult.callType.callType} and was not scored.`,
          strengths: [],
          areas_for_improvement: [],
          recommendations: [],
          criteria_results: [],
          audit_template_id: template?.id,
        });

        // Update call status
        await supabase
          .from("calls")
          .update({ status: 'audited', call_type: auditResult.callType.callType })
          .eq("id", callId);

        return { success: true };
      }

      // Store report card with validated scores
      const { error: insertError } = await supabase.from("report_cards").insert({
        user_id: call.user_id,
        call_id: callId,
        source_file: call.source_file || `call-${callId}`,
        source_type: 'call',
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
        audit_template_id: template?.id,
      });

      if (insertError) {
        console.error("Failed to insert report card:", insertError);
        return { success: false, error: `Failed to save report card: ${insertError.message}` };
      }

      // Update call status
      await supabase
        .from("calls")
        .update({
          status: 'audited',
          call_type: auditResult.callType?.callType || call.call_type,
        })
        .eq("id", callId);

      console.log(`Call ${callId} audited successfully. Score: ${auditResult.overall_score}`);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Audit error:", errorMessage);

      // Update call status to failed so we can retry later
      await supabase
        .from("calls")
        .update({ status: 'audit_failed' })
        .eq("id", callId);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Perform local AI audit using configured provider
   * Settings come from company_settings.ai_settings (saved by AISettingsPanel)
   */
  private async performLocalAudit(
    transcript: string,
    template: any,
    settings: any
  ): Promise<any> {
    const provider = settings.provider || 'gemini';
    let endpoint = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    switch (provider) {
      case 'ollama':
        if (!settings.host) {
          throw new Error('Ollama host not configured');
        }
        endpoint = `${settings.host}/v1/chat/completions`;
        break;
      case 'openai':
        endpoint = 'https://api.openai.com/v1/chat/completions';
        if (settings.apiKey) {
          headers['Authorization'] = `Bearer ${settings.apiKey}`;
        }
        break;
      case 'gemini':
      default:
        // Use Gemini API - this method shouldn't be called for Gemini
        // as we use the dedicated Gemini provider instead
        throw new Error('Use performAudit with Gemini provider instead');
    }

    const criteria = template?.criteria || this.getDefaultCriteria();
    const prompt = this.buildAuditPrompt(transcript, criteria);

    try {
      // Use unified OpenAI-compatible format for all providers
      const requestBody = {
        model: settings.model || 'local-model',
        messages: [
          {
            role: 'system',
            content: 'You are an expert call quality auditor. Analyze transcripts and provide detailed, constructive feedback. Always respond with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: settings.temperature || 0.3,
        max_tokens: settings.maxTokens || 4000,
      };

      console.log("Sending audit request to AI...");
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI request failed:", response.status, errorText);
        return null;
      }

      const result = await response.json();
      // OpenAI-compatible format always uses choices[0].message.content
      const content = result.choices?.[0]?.message?.content || '';

      console.log("AI response received, parsing...");
      return this.parseAuditResponse(content);
    } catch (error) {
      console.error("AI audit error:", error);
      return null;
    }
  }

  /**
   * Build the audit prompt for the AI
   */
  private buildAuditPrompt(transcript: string, criteria: any[]): string {
    const criteriaList = criteria.map((c: any) =>
      `- ${c.code}: ${c.name} - ${c.description} (Weight: ${c.weight || 1})`
    ).join('\n');

    return `You are an expert call quality auditor. Analyze the following call transcript and provide a detailed quality assessment.

AUDIT CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript}

Respond in JSON format with the following structure:
{
  "overall_score": number (0-100),
  "communication_score": number (0-100),
  "compliance_score": number (0-100),
  "accuracy_score": number (0-100),
  "tone_score": number (0-100),
  "empathy_score": number (0-100),
  "resolution_score": number (0-100),
  "feedback": "Overall summary paragraph",
  "strengths": ["strength 1", "strength 2", ...],
  "areas_for_improvement": ["area 1", "area 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "criteria_results": {
    "CRITERIA_CODE": {
      "result": "PASS" | "PARTIAL" | "FAIL",
      "score": number (0-100),
      "explanation": "explanation text",
      "recommendation": "specific recommendation"
    }
  }
}

Provide accurate, constructive feedback focused on helping the agent improve.`;
  }

  /**
   * Parse the AI response into structured data
   */
  private parseAuditResponse(content: string): any {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (error) {
      console.error("Failed to parse audit response:", error);
      return null;
    }
  }

  /**
   * Get default audit criteria if no template exists
   */
  private getDefaultCriteria() {
    return [
      { code: 'GREETING', name: 'Professional Greeting', description: 'Proper introduction and verification', weight: 1 },
      { code: 'COMPLIANCE', name: 'Compliance', description: 'Following required disclosures and regulations', weight: 2 },
      { code: 'TONE', name: 'Professional Tone', description: 'Maintaining professional and respectful tone', weight: 1 },
      { code: 'EMPATHY', name: 'Empathy', description: 'Showing understanding and empathy', weight: 1 },
      { code: 'RESOLUTION', name: 'Issue Resolution', description: 'Effectively addressing customer concerns', weight: 2 },
      { code: 'CLOSING', name: 'Proper Closing', description: 'Professional call closing', weight: 1 },
    ];
  }

  /**
   * Trigger conversation intelligence analysis
   */
  async triggerConversationAnalysis(callId: string): Promise<void> {
    try {
      const { data: call } = await supabase
        .from("calls")
        .select("*")
        .eq("id", callId)
        .single();

      if (!call || !call.transcript_text) return;

      // Get keywords library
      const { data: keywords } = await supabase
        .from("keyword_library")
        .select("*")
        .eq("is_active", true);

      // Analyze the transcript
      const analysis = this.analyzeTranscript(call.transcript_text, keywords || []);

      // Store analysis
      await supabase.from("call_analytics").insert({
        call_id: callId,
        user_id: call.user_id,
        call_duration_seconds: call.call_duration_seconds,
        ...analysis,
      });
    } catch (error) {
      console.error("Conversation analysis error:", error);
    }
  }

  /**
   * Analyze transcript for keywords, sentiment, etc.
   */
  private analyzeTranscript(transcript: string, keywords: any[]) {
    const lowerTranscript = transcript.toLowerCase();
    const words = transcript.split(/\s+/);

    // Keyword detection
    const keywordsFound: any[] = [];
    let complianceCount = 0;
    let prohibitedCount = 0;
    let empathyCount = 0;
    let escalationCount = 0;

    for (const kw of keywords) {
      const phrase = kw.phrase.toLowerCase();
      const count = (lowerTranscript.match(new RegExp(phrase, 'gi')) || []).length;

      if (count > 0) {
        keywordsFound.push({
          phrase: kw.phrase,
          category: kw.category,
          count,
          weight: kw.weight || 1,
        });

        switch (kw.category) {
          case 'compliance': complianceCount += count; break;
          case 'prohibited': prohibitedCount += count; break;
          case 'empathy': empathyCount += count; break;
          case 'escalation': escalationCount += count; break;
        }
      }
    }

    // Simple sentiment analysis based on word lists
    const positiveWords = ['thank', 'appreciate', 'understand', 'help', 'great', 'excellent', 'happy', 'glad', 'wonderful', 'perfect'];
    const negativeWords = ['angry', 'upset', 'frustrated', 'terrible', 'awful', 'horrible', 'hate', 'worst', 'never', 'ridiculous'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      const lower = word.toLowerCase().replace(/[^a-z]/g, '');
      if (positiveWords.includes(lower)) positiveCount++;
      if (negativeWords.includes(lower)) negativeCount++;
    }

    const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length / 100, 1);
    const clampedScore = Math.max(-1, Math.min(1, sentimentScore));

    let overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed' = 'neutral';
    if (clampedScore > 0.3) overallSentiment = 'positive';
    else if (clampedScore < -0.3) overallSentiment = 'negative';
    else if (positiveCount > 2 && negativeCount > 2) overallSentiment = 'mixed';

    return {
      overall_sentiment: overallSentiment,
      sentiment_score: clampedScore,
      keywords_found: keywordsFound,
      compliance_keywords_found: complianceCount,
      prohibited_keywords_found: prohibitedCount,
      empathy_keywords_found: empathyCount,
      escalation_triggers_found: escalationCount,
    };
  }

  /**
   * Get all calls for an agent with related data
   */
  async getAgentCalls(userId: string, options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    limit?: number;
  }) {
    let query = supabase
      .from("calls")
      .select(`
        *,
        report_cards(*),
        call_analytics(*)
      `)
      .eq("user_id", userId)
      .order("call_start_time", { ascending: false });

    if (options?.startDate) {
      query = query.gte("call_start_time", options.startDate);
    }
    if (options?.endDate) {
      query = query.lte("call_start_time", options.endDate);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Get performance summary for an agent
   */
  async getAgentPerformance(userId: string, startDate?: string, endDate?: string) {
    const { data: reportCards } = await supabase
      .from("report_cards")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte("created_at", endDate || new Date().toISOString());

    if (!reportCards || reportCards.length === 0) {
      return null;
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    return {
      totalCalls: reportCards.length,
      averageScore: avg(reportCards.map(r => r.overall_score)),
      communicationAvg: avg(reportCards.filter(r => r.communication_score).map(r => r.communication_score)),
      complianceAvg: avg(reportCards.filter(r => r.compliance_score).map(r => r.compliance_score)),
      toneAvg: avg(reportCards.filter(r => r.tone_score).map(r => r.tone_score)),
      empathyAvg: avg(reportCards.filter(r => r.empathy_score).map(r => r.empathy_score)),
      resolutionAvg: avg(reportCards.filter(r => r.resolution_score).map(r => r.resolution_score)),
      trend: reportCards.slice(0, 10).map(r => ({
        date: r.created_at,
        score: r.overall_score,
      })),
    };
  }

  /**
   * Process all pending calls that have transcripts but no report cards
   * This is the main auto-processing function
   */
  async processPendingCalls(options: {
    batchSize?: number;
    delayBetweenCalls?: number;
    onProgress?: (current: number, total: number, callId: string, success: boolean) => void;
  } = {}): Promise<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ callId: string; error: string }>;
  }> {
    const batchSize = options.batchSize || 10;
    const delayMs = options.delayBetweenCalls || 1000; // 1 second between calls to avoid rate limits

    // Find calls that:
    // 1. Have a transcript
    // 2. Status is 'transcribed' or 'audit_failed' (for retries)
    // 3. Don't have a report card yet
    const { data: pendingCalls, error } = await supabase
      .from("calls")
      .select(`
        id,
        transcript_text,
        status,
        report_cards(id)
      `)
      .in("status", ['transcribed', 'audit_failed'])
      .not("transcript_text", "is", null)
      .limit(batchSize);

    if (error) {
      console.error("Error fetching pending calls:", error);
      return { total: 0, successful: 0, failed: 0, errors: [{ callId: 'query', error: error.message }] };
    }

    // Filter to only calls without report cards
    const callsToProcess = (pendingCalls || []).filter(
      (call: any) => !call.report_cards || call.report_cards.length === 0
    );

    if (callsToProcess.length === 0) {
      console.log("No pending calls to process");
      return { total: 0, successful: 0, failed: 0, errors: [] };
    }

    console.log(`Processing ${callsToProcess.length} pending calls...`);

    let successful = 0;
    let failed = 0;
    const errors: Array<{ callId: string; error: string }> = [];

    for (let i = 0; i < callsToProcess.length; i++) {
      const call = callsToProcess[i];

      try {
        const result = await this.triggerAudit(call.id);

        if (result.success) {
          successful++;
          console.log(`[${i + 1}/${callsToProcess.length}] Call ${call.id} processed successfully`);
        } else {
          failed++;
          errors.push({ callId: call.id, error: result.error || 'Unknown error' });
          console.error(`[${i + 1}/${callsToProcess.length}] Call ${call.id} failed: ${result.error}`);
        }

        options.onProgress?.(i + 1, callsToProcess.length, call.id, result.success);

        // Delay between calls to avoid rate limiting
        if (i < callsToProcess.length - 1 && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ callId: call.id, error: errorMsg });
        console.error(`[${i + 1}/${callsToProcess.length}] Call ${call.id} threw error: ${errorMsg}`);
      }
    }

    console.log(`Batch processing complete: ${successful} successful, ${failed} failed`);

    return {
      total: callsToProcess.length,
      successful,
      failed,
      errors,
    };
  }

  /**
   * Get count of calls pending audit
   */
  async getPendingAuditCount(): Promise<number> {
    const { count, error } = await supabase
      .from("calls")
      .select("id", { count: 'exact', head: true })
      .in("status", ['transcribed', 'audit_failed'])
      .not("transcript_text", "is", null);

    if (error) {
      console.error("Error counting pending calls:", error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Retry failed audits only
   */
  async retryFailedAudits(batchSize: number = 10): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const { data: failedCalls } = await supabase
      .from("calls")
      .select("id")
      .eq("status", 'audit_failed')
      .limit(batchSize);

    if (!failedCalls || failedCalls.length === 0) {
      return { total: 0, successful: 0, failed: 0 };
    }

    let successful = 0;
    let failed = 0;

    for (const call of failedCalls) {
      const result = await this.triggerAudit(call.id);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
      // Small delay between retries
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return { total: failedCalls.length, successful, failed };
  }
}

export const callIngestionService = new CallIngestionService();
