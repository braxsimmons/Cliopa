/**
 * Process Call Queue Edge Function
 *
 * Automatically processes queued calls with AI auditing.
 * Can be triggered via:
 * - Supabase cron (pg_cron)
 * - External scheduler (e.g., GitHub Actions, cron job)
 * - Manual trigger from admin UI
 *
 * Deploy: npx supabase functions deploy process-call-queue
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AISettings {
  enabled: boolean;
  provider: "lmstudio" | "ollama" | "openai";
  model: string;
  lmstudio_url?: string;
  ollama_url?: string;
  openai_api_key?: string;
}

interface AuditTemplate {
  id: string;
  name: string;
  criteria: Array<{
    code: string;
    name: string;
    description: string;
    weight: number;
  }>;
}

interface CallToProcess {
  call_id: string;
  user_id: string;
  transcript_text: string;
  call_start_time: string;
  call_duration_seconds: number;
  campaign_name: string;
  disposition: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default audit criteria if no template exists
const DEFAULT_CRITERIA = [
  { code: "GREETING", name: "Professional Greeting", description: "Proper introduction and verification", weight: 1 },
  { code: "COMPLIANCE", name: "Compliance", description: "Following required disclosures and regulations", weight: 2 },
  { code: "TONE", name: "Professional Tone", description: "Maintaining professional and respectful tone", weight: 1 },
  { code: "EMPATHY", name: "Empathy", description: "Showing understanding and empathy", weight: 1 },
  { code: "RESOLUTION", name: "Issue Resolution", description: "Effectively addressing customer concerns", weight: 2 },
  { code: "CLOSING", name: "Proper Closing", description: "Professional call closing", weight: 1 },
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for optional parameters
    let batchSize = 10;
    try {
      const body = await req.json();
      batchSize = body.batchSize || 10;
    } catch {
      // No body or invalid JSON - use defaults
    }

    console.log(`Processing call queue with batch size: ${batchSize}`);

    // First, queue any pending calls
    const { data: queuedCount } = await supabase.rpc("queue_pending_calls");
    console.log(`Queued ${queuedCount || 0} pending calls`);

    // Get calls to process
    const { data: calls, error: callsError } = await supabase.rpc("get_calls_to_process", {
      batch_size: batchSize,
    });

    if (callsError) {
      console.error("Error getting calls:", callsError);
      return new Response(
        JSON.stringify({ error: "Failed to get calls", details: callsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!calls || calls.length === 0) {
      console.log("No calls to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No calls to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${calls.length} calls to process`);

    // Get AI settings
    const { data: settings } = await supabase
      .from("ai_settings")
      .select("*")
      .single();

    if (!settings?.enabled) {
      console.log("AI auditing is disabled");
      return new Response(
        JSON.stringify({ success: false, error: "AI auditing is disabled in settings" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get default audit template
    const { data: template } = await supabase
      .from("audit_templates")
      .select("*")
      .eq("is_default", true)
      .single();

    const criteria = template?.criteria || DEFAULT_CRITERIA;

    // Process each call
    const results = [];
    for (const call of calls as CallToProcess[]) {
      try {
        // Mark as processing
        await supabase.rpc("mark_call_processing", { p_call_id: call.call_id });

        console.log(`Processing call: ${call.call_id}`);

        // Run AI audit
        const auditResult = await runAIAudit(call.transcript_text, criteria, settings);

        if (auditResult) {
          // Store results
          const { data: reportCardId, error: completeError } = await supabase.rpc(
            "complete_call_processing",
            {
              p_call_id: call.call_id,
              p_overall_score: auditResult.overall_score,
              p_communication_score: auditResult.communication_score,
              p_compliance_score: auditResult.compliance_score,
              p_accuracy_score: auditResult.accuracy_score,
              p_tone_score: auditResult.tone_score,
              p_empathy_score: auditResult.empathy_score,
              p_resolution_score: auditResult.resolution_score,
              p_feedback: auditResult.feedback,
              p_strengths: auditResult.strengths,
              p_areas_for_improvement: auditResult.areas_for_improvement,
              p_recommendations: auditResult.recommendations,
              p_criteria_results: auditResult.criteria_results,
            }
          );

          if (completeError) {
            throw new Error(completeError.message);
          }

          // Also run conversation analysis
          await runConversationAnalysis(supabase, call);

          results.push({
            callId: call.call_id,
            success: true,
            reportCardId,
          });

          console.log(`Completed call: ${call.call_id}`);
        } else {
          throw new Error("AI audit returned no results");
        }
      } catch (error: any) {
        console.error(`Failed to process call ${call.call_id}:`, error);

        await supabase.rpc("fail_call_processing", {
          p_call_id: call.call_id,
          p_error: error.message,
        });

        results.push({
          callId: call.call_id,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Queue processing error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function runAIAudit(
  transcript: string,
  criteria: any[],
  settings: AISettings
): Promise<any> {
  const provider = settings.provider || "ollama";
  let endpoint = "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  switch (provider) {
    case "lmstudio":
      endpoint = `${settings.lmstudio_url || "http://localhost:1234"}/v1/chat/completions`;
      break;
    case "ollama":
      endpoint = `${settings.ollama_url || "http://localhost:11434"}/api/chat`;
      break;
    case "openai":
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers["Authorization"] = `Bearer ${settings.openai_api_key}`;
      break;
    default:
      throw new Error("No AI provider configured");
  }

  const criteriaList = criteria
    .map((c: any) => `- ${c.code}: ${c.name} - ${c.description} (Weight: ${c.weight || 1})`)
    .join("\n");

  const prompt = `You are an expert call quality auditor. Analyze the following call transcript and provide a detailed quality assessment.

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

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(
      provider === "ollama"
        ? {
            model: settings.model || "llama3.2",
            messages: [{ role: "user", content: prompt }],
            stream: false,
          }
        : {
            model: settings.model || "gpt-4",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }
    ),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI request failed: ${errorText}`);
  }

  const result = await response.json();
  const content = provider === "ollama"
    ? result.message?.content
    : result.choices?.[0]?.message?.content;

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Could not parse AI response");
}

async function runConversationAnalysis(supabase: any, call: CallToProcess) {
  try {
    // Get keywords library
    const { data: keywords } = await supabase
      .from("keyword_library")
      .select("*")
      .eq("is_active", true);

    const transcript = call.transcript_text.toLowerCase();
    const words = call.transcript_text.split(/\s+/);

    // Keyword detection
    const keywordsFound: any[] = [];
    let complianceCount = 0;
    let prohibitedCount = 0;
    let empathyCount = 0;
    let escalationCount = 0;

    for (const kw of keywords || []) {
      const phrase = kw.phrase.toLowerCase();
      const count = (transcript.match(new RegExp(phrase, "gi")) || []).length;

      if (count > 0) {
        keywordsFound.push({
          phrase: kw.phrase,
          category: kw.category,
          count,
          weight: kw.weight || 1,
        });

        switch (kw.category) {
          case "compliance": complianceCount += count; break;
          case "prohibited": prohibitedCount += count; break;
          case "empathy": empathyCount += count; break;
          case "escalation": escalationCount += count; break;
        }
      }
    }

    // Simple sentiment analysis
    const positiveWords = ["thank", "appreciate", "understand", "help", "great", "excellent", "happy", "glad", "wonderful", "perfect"];
    const negativeWords = ["angry", "upset", "frustrated", "terrible", "awful", "horrible", "hate", "worst", "never", "ridiculous"];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      const lower = word.toLowerCase().replace(/[^a-z]/g, "");
      if (positiveWords.includes(lower)) positiveCount++;
      if (negativeWords.includes(lower)) negativeCount++;
    }

    const sentimentScore = (positiveCount - negativeCount) / Math.max(words.length / 100, 1);
    const clampedScore = Math.max(-1, Math.min(1, sentimentScore));

    let overallSentiment: string = "neutral";
    if (clampedScore > 0.3) overallSentiment = "positive";
    else if (clampedScore < -0.3) overallSentiment = "negative";
    else if (positiveCount > 2 && negativeCount > 2) overallSentiment = "mixed";

    // Store analysis
    await supabase.from("call_analytics").insert({
      call_id: call.call_id,
      user_id: call.user_id,
      call_duration_seconds: call.call_duration_seconds,
      overall_sentiment: overallSentiment,
      sentiment_score: clampedScore,
      keywords_found: keywordsFound,
      compliance_keywords_found: complianceCount,
      prohibited_keywords_found: prohibitedCount,
      empathy_keywords_found: empathyCount,
      escalation_triggers_found: escalationCount,
    });
  } catch (error) {
    console.error("Conversation analysis error:", error);
    // Don't fail the whole process if analysis fails
  }
}
