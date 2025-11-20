/**
 * Automatic Call Audit Service
 *
 * Processes transcribed calls through AI audit and creates report cards.
 * Can use either OpenAI or local LM Studio (configured in settings).
 *
 * Deploy: npx supabase functions deploy audit-call
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AuditRequest {
  callId: string;
}

interface AuditCriterion {
  id: string;
  result: "PASS" | "PARTIAL" | "FAIL";
  explanation: string;
  recommendation: string;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callId }: AuditRequest = await req.json();

    console.log("Auditing call:", callId);

    // Get call with transcript
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (callError || !call || !call.transcript_text) {
      throw new Error("Call not found or missing transcript");
    }

    // Load audit template
    const { data: template } = await supabase
      .from("audit_templates")
      .select("criteria")
      .eq("is_default", true)
      .single();

    const criteria = template?.criteria || [];

    // Build audit prompt
    const prompt = buildAuditPrompt(call.transcript_text, criteria);

    // Call OpenAI for audit
    const startTime = Date.now();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional call quality auditor. Analyze transcripts and provide structured JSON feedback.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    const completion = await response.json();
    const auditResult = JSON.parse(completion.choices[0].message.content);

    const processingTime = Date.now() - startTime;

    console.log("Audit complete, score:", auditResult.overall_score);

    // Calculate dimensional scores
    const dimensionalScores = calculateDimensionalScores(auditResult.criteria);

    // Create report card
    const { data: reportCard, error: reportError } = await supabase
      .from("report_cards")
      .insert({
        user_id: call.user_id,
        call_id: call.id,
        source_file: call.call_id || "five9_call",
        source_type: "call",
        overall_score: auditResult.overall_score,
        communication_score: dimensionalScores.communication,
        compliance_score: dimensionalScores.compliance,
        accuracy_score: dimensionalScores.accuracy,
        tone_score: dimensionalScores.tone,
        empathy_score: dimensionalScores.empathy,
        resolution_score: dimensionalScores.resolution,
        feedback: auditResult.summary,
        strengths: extractStrengths(auditResult.criteria),
        areas_for_improvement: extractImprovements(auditResult.criteria),
        recommendations: extractRecommendations(auditResult.criteria),
        criteria_results: auditResult.criteria,
        ai_model: "gpt-4o-mini",
        ai_provider: "openai",
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (reportError) {
      console.error("Failed to create report card:", reportError);
      throw new Error("Failed to create report card");
    }

    // Update call status
    await supabase
      .from("calls")
      .update({
        status: "audited",
        audit_id: reportCard.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);

    // TODO: Send real-time notification to managers
    // Could use Supabase Realtime or push notifications here

    console.log("Report card created:", reportCard.id);

    return new Response(
      JSON.stringify({
        success: true,
        callId,
        reportCardId: reportCard.id,
        overallScore: auditResult.overall_score,
        processingTimeMs: processingTime,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Audit error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Helper functions
function buildAuditPrompt(transcript: string, criteria: any[]): string {
  const criteriaList = criteria.map((c) => `- ${c.id}: ${c.name} - ${c.description}`).join("\n");

  return `
Audit this call transcript against the following criteria:

CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript}

Provide JSON response:
{
  "overall_score": <0-100>,
  "summary": "<paragraph summary>",
  "criteria": [{"id": "<id>", "result": "PASS|PARTIAL|FAIL", "explanation": "...", "recommendation": "..."}]
}

PASS = 100 points, PARTIAL = 50 points, FAIL = 0 points.
Calculate overall_score as weighted average.
Return ONLY valid JSON.
`.trim();
}

function calculateDimensionalScores(criteria: AuditCriterion[]) {
  const communicationCriteria = ["WHY_SMILE", "WHAT_LISTEN_EXPLORE"];
  const complianceCriteria = ["QQ", "VCI", "PERMISSION", "BANKV"];
  const accuracyCriteria = ["NOTES", "CAMPAIGN", "LOAN_DOCUMENT"];
  const toneCriteria = ["WHY_SMILE", "WHAT_EMPATHY"];
  const empathyCriteria = ["WHAT_EMPATHY", "WHAT_LISTEN_EXPLORE"];
  const resolutionCriteria = ["WHERE_RESOLUTION", "FOLLOWUP"];

  const getAvgScore = (ids: string[]) => {
    const relevant = criteria.filter((c) => ids.includes(c.id));
    if (relevant.length === 0) return null;
    const sum = relevant.reduce((acc, c) => {
      if (c.result === "PASS") return acc + 100;
      if (c.result === "PARTIAL") return acc + 50;
      return acc;
    }, 0);
    return Math.round(sum / relevant.length);
  };

  return {
    communication: getAvgScore(communicationCriteria),
    compliance: getAvgScore(complianceCriteria),
    accuracy: getAvgScore(accuracyCriteria),
    tone: getAvgScore(toneCriteria),
    empathy: getAvgScore(empathyCriteria),
    resolution: getAvgScore(resolutionCriteria),
  };
}

function extractStrengths(criteria: AuditCriterion[]): string[] {
  return criteria
    .filter((c) => c.result === "PASS")
    .map((c) => c.explanation)
    .slice(0, 5);
}

function extractImprovements(criteria: AuditCriterion[]): string[] {
  return criteria
    .filter((c) => c.result === "FAIL" || c.result === "PARTIAL")
    .map((c) => c.explanation)
    .slice(0, 5);
}

function extractRecommendations(criteria: AuditCriterion[]): string[] {
  return criteria
    .filter((c) => c.result === "FAIL" || c.result === "PARTIAL")
    .map((c) => c.recommendation)
    .filter((r) => r && r.length > 0)
    .slice(0, 5);
}
