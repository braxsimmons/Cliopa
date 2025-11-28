/**
 * Conversation Intelligence Analyzer
 *
 * Processes transcribed calls for:
 * - Sentiment analysis
 * - Keyword detection
 * - Script adherence
 * - Talk pattern analysis
 * - Call outcome classification
 *
 * Supports both OpenAI and LM Studio (local LLM)
 *
 * Deploy: npx supabase functions deploy analyze-conversation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AnalyzeRequest {
  callId: string;
  scriptTemplateId?: string;
}

interface KeywordLibrary {
  id: string;
  name: string;
  category: string;
  keywords: Array<{ phrase: string; weight: number; exact_match: boolean }>;
}

interface KeywordMatch {
  phrase: string;
  category: string;
  library: string;
  count: number;
  weight: number;
}

interface SentimentPoint {
  timestamp: number;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  text: string;
}

interface AIConfig {
  provider: "openai" | "lmstudio" | "local";
  apiKey: string;
  endpoint: string;
  model: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get AI configuration from company settings or environment
async function getAIConfig(supabase: any): Promise<AIConfig> {
  // Try to get settings from company_settings table
  const { data: settings } = await supabase
    .from("company_settings")
    .select("ai_provider, ai_api_key, ai_endpoint, ai_model")
    .single();

  // Default to OpenAI if no settings found
  const provider = settings?.ai_provider || Deno.env.get("AI_PROVIDER") || "openai";

  // LM Studio default endpoint
  const lmStudioEndpoint = Deno.env.get("LMSTUDIO_ENDPOINT") || "http://localhost:1234/v1";

  if (provider === "lmstudio" || provider === "local") {
    return {
      provider: "lmstudio",
      apiKey: "lm-studio", // LM Studio doesn't require a real key
      endpoint: settings?.ai_endpoint || lmStudioEndpoint,
      model: settings?.ai_model || Deno.env.get("LMSTUDIO_MODEL") || "local-model",
    };
  }

  // OpenAI configuration
  return {
    provider: "openai",
    apiKey: settings?.ai_api_key || Deno.env.get("OPENAI_API_KEY") || "",
    endpoint: "https://api.openai.com/v1",
    model: settings?.ai_model || "gpt-4o-mini",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callId, scriptTemplateId }: AnalyzeRequest = await req.json();

    console.log("Analyzing conversation for call:", callId);
    const startTime = Date.now();

    // Get AI configuration
    const aiConfig = await getAIConfig(supabase);
    console.log("Using AI provider:", aiConfig.provider, "model:", aiConfig.model);

    // Get call with transcript
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single();

    if (callError || !call || !call.transcript_text) {
      throw new Error("Call not found or missing transcript");
    }

    // Load keyword libraries
    const { data: libraries } = await supabase
      .from("keyword_libraries")
      .select("*")
      .eq("is_active", true);

    const keywordLibraries: KeywordLibrary[] = libraries || [];

    // Load script template if specified or get default
    let scriptTemplate = null;
    if (scriptTemplateId) {
      const { data: template } = await supabase
        .from("script_templates")
        .select("*")
        .eq("id", scriptTemplateId)
        .single();
      scriptTemplate = template;
    }

    const transcript = call.transcript_text;

    // 1. Analyze keywords (no AI needed)
    const keywordResults = analyzeKeywords(transcript, keywordLibraries);

    // 2. Analyze sentiment with AI
    const sentimentResult = await analyzeSentimentWithAI(transcript, aiConfig);

    // 3. Check script adherence (no AI needed)
    const scriptAdherence = scriptTemplate
      ? checkScriptAdherence(transcript, scriptTemplate)
      : null;

    // 4. Classify call outcome with AI
    const outcomeResult = await classifyCallOutcome(transcript, aiConfig);

    // 5. Analyze talk patterns (basic - from transcript structure)
    const talkPatterns = analyzeTalkPatterns(transcript, call.call_duration_seconds);

    const processingTime = Date.now() - startTime;

    // Create call analytics record
    const { data: analytics, error: analyticsError } = await supabase
      .from("call_analytics")
      .insert({
        call_id: callId,
        user_id: call.user_id,
        call_duration_seconds: call.call_duration_seconds,
        agent_talk_time_seconds: talkPatterns.agentTalkTime,
        customer_talk_time_seconds: talkPatterns.customerTalkTime,
        silence_time_seconds: talkPatterns.silenceTime,
        talk_to_listen_ratio: talkPatterns.talkToListenRatio,
        overall_sentiment: sentimentResult.overall,
        sentiment_score: sentimentResult.score,
        sentiment_timeline: sentimentResult.timeline,
        keywords_found: keywordResults.matches,
        compliance_keywords_found: keywordResults.counts.compliance,
        prohibited_keywords_found: keywordResults.counts.prohibited,
        empathy_keywords_found: keywordResults.counts.empathy,
        escalation_triggers_found: keywordResults.counts.escalation,
        script_template_id: scriptTemplateId,
        script_adherence_score: scriptAdherence?.score,
        script_phrases_matched: scriptAdherence?.matched || [],
        script_phrases_missed: scriptAdherence?.missed || [],
        call_outcome: outcomeResult.outcome,
        call_topics: outcomeResult.topics,
        customer_intent: outcomeResult.intent,
        dead_air_count: talkPatterns.deadAirCount,
        interruption_count: talkPatterns.interruptionCount,
        ai_summary: outcomeResult.summary,
        ai_recommendations: outcomeResult.recommendations,
        ai_model: `${aiConfig.provider}/${aiConfig.model}`,
        processing_time_ms: processingTime,
      })
      .select()
      .single();

    if (analyticsError) {
      console.error("Failed to create analytics:", analyticsError);
      throw new Error("Failed to create analytics record");
    }

    console.log("Conversation analysis complete:", analytics.id);

    return new Response(
      JSON.stringify({
        success: true,
        callId,
        analyticsId: analytics.id,
        sentiment: sentimentResult.overall,
        keywordsFound: keywordResults.matches.length,
        scriptAdherence: scriptAdherence?.score,
        aiProvider: aiConfig.provider,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Analysis error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================
// Keyword Analysis
// ============================================
function analyzeKeywords(
  transcript: string,
  libraries: KeywordLibrary[]
): {
  matches: KeywordMatch[];
  counts: { compliance: number; prohibited: number; empathy: number; escalation: number };
} {
  const lowerTranscript = transcript.toLowerCase();
  const matches: KeywordMatch[] = [];
  const counts = { compliance: 0, prohibited: 0, empathy: 0, escalation: 0 };

  for (const library of libraries) {
    for (const keyword of library.keywords) {
      const phrase = keyword.phrase.toLowerCase();

      // Count occurrences
      let count = 0;
      let pos = 0;
      while ((pos = lowerTranscript.indexOf(phrase, pos)) !== -1) {
        count++;
        pos += phrase.length;
      }

      if (count > 0) {
        matches.push({
          phrase: keyword.phrase,
          category: library.category,
          library: library.name,
          count,
          weight: keyword.weight,
        });

        // Update category counts
        if (library.category === "compliance") counts.compliance += count;
        else if (library.category === "prohibited") counts.prohibited += count;
        else if (library.category === "empathy") counts.empathy += count;
        else if (library.category === "escalation") counts.escalation += count;
      }
    }
  }

  return { matches, counts };
}

// ============================================
// Sentiment Analysis with AI
// ============================================
async function analyzeSentimentWithAI(
  transcript: string,
  aiConfig: AIConfig
): Promise<{
  overall: "positive" | "neutral" | "negative" | "mixed";
  score: number;
  timeline: SentimentPoint[];
}> {
  const prompt = `
Analyze the sentiment of this call transcript.

TRANSCRIPT:
${transcript.slice(0, 8000)}

Return JSON:
{
  "overall": "positive" | "neutral" | "negative" | "mixed",
  "score": <number from -1.0 to 1.0>,
  "timeline": [
    {"segment": 1, "sentiment": "positive|neutral|negative", "score": <-1 to 1>, "summary": "<brief summary>"}
  ],
  "reasoning": "<brief explanation>"
}

Break the call into 3-5 segments and analyze sentiment progression.
Return ONLY valid JSON.
`.trim();

  try {
    const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: "You are a sentiment analysis expert. Analyze call transcripts and return structured JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: aiConfig.provider === "openai" ? { type: "json_object" } : undefined,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`AI sentiment API error: ${response.status}`);
      return { overall: "neutral", score: 0, timeline: [] };
    }

    const completion = await response.json();
    const content = completion.choices[0].message.content;

    // Try to parse JSON from response (handle LM Studio which may not use json_object format)
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }

    const timeline: SentimentPoint[] = (result.timeline || []).map(
      (seg: any, idx: number) => ({
        timestamp: idx,
        sentiment: seg.sentiment,
        score: seg.score,
        text: seg.summary,
      })
    );

    return {
      overall: result.overall || "neutral",
      score: result.score || 0,
      timeline,
    };
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return { overall: "neutral", score: 0, timeline: [] };
  }
}

// ============================================
// Script Adherence Check
// ============================================
function checkScriptAdherence(
  transcript: string,
  template: any
): { score: number; matched: string[]; missed: string[] } {
  const lowerTranscript = transcript.toLowerCase();
  const matched: string[] = [];
  const missed: string[] = [];

  const requiredPhrases = template.required_phrases || [];

  for (const phrase of requiredPhrases) {
    if (lowerTranscript.includes(phrase.phrase.toLowerCase())) {
      matched.push(phrase.phrase);
    } else if (phrase.required) {
      missed.push(phrase.phrase);
    }
  }

  const requiredCount = requiredPhrases.filter((p: any) => p.required).length;
  const matchedRequired = matched.filter((m) =>
    requiredPhrases.some((p: any) => p.phrase === m && p.required)
  ).length;

  const score = requiredCount > 0 ? (matchedRequired / requiredCount) * 100 : 100;

  return { score: Math.round(score), matched, missed };
}

// ============================================
// Call Outcome Classification
// ============================================
async function classifyCallOutcome(
  transcript: string,
  aiConfig: AIConfig
): Promise<{
  outcome: string | null;
  topics: string[];
  intent: string | null;
  summary: string;
  recommendations: string[];
}> {
  const outcomes = [
    "payment_collected",
    "payment_arrangement",
    "callback_scheduled",
    "dispute",
    "wrong_party",
    "refused_to_pay",
    "disconnected",
    "voicemail",
    "no_contact",
    "other",
  ];

  const prompt = `
Analyze this call transcript and classify the outcome.

TRANSCRIPT:
${transcript.slice(0, 8000)}

Return JSON:
{
  "outcome": "${outcomes.join('" | "')}",
  "topics": ["<topic1>", "<topic2>"],
  "customer_intent": "<what the customer wanted>",
  "summary": "<2-3 sentence summary>",
  "recommendations": ["<coaching recommendation 1>", "<coaching recommendation 2>"]
}

Return ONLY valid JSON.
`.trim();

  try {
    const response = await fetch(`${aiConfig.endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: "You are a call center analyst. Classify call outcomes and provide coaching insights.",
          },
          { role: "user", content: prompt },
        ],
        response_format: aiConfig.provider === "openai" ? { type: "json_object" } : undefined,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`AI classification API error: ${response.status}`);
      return { outcome: null, topics: [], intent: null, summary: "", recommendations: [] };
    }

    const completion = await response.json();
    const content = completion.choices[0].message.content;

    // Try to parse JSON from response
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON from response");
      }
    }

    return {
      outcome: outcomes.includes(result.outcome) ? result.outcome : null,
      topics: result.topics || [],
      intent: result.customer_intent || null,
      summary: result.summary || "",
      recommendations: result.recommendations || [],
    };
  } catch (error) {
    console.error("Classification error:", error);
    return { outcome: null, topics: [], intent: null, summary: "", recommendations: [] };
  }
}

// ============================================
// Talk Pattern Analysis
// ============================================
function analyzeTalkPatterns(
  transcript: string,
  durationSeconds: number | null
): {
  agentTalkTime: number | null;
  customerTalkTime: number | null;
  silenceTime: number | null;
  talkToListenRatio: number | null;
  deadAirCount: number;
  interruptionCount: number;
} {
  // Basic analysis from transcript structure
  // Look for speaker labels like "Agent:" or "Customer:" or "[Agent]" etc.
  const agentPatterns = /\b(agent|rep|representative|advisor):/gi;
  const customerPatterns = /\b(customer|caller|client|debtor):/gi;

  const agentMatches = transcript.match(agentPatterns) || [];
  const customerMatches = transcript.match(customerPatterns) || [];

  const totalTurns = agentMatches.length + customerMatches.length;

  // Estimate talk times based on turn ratio and duration
  let agentTalkTime = null;
  let customerTalkTime = null;
  let silenceTime = null;
  let talkToListenRatio = null;

  if (durationSeconds && totalTurns > 0) {
    const agentRatio = agentMatches.length / totalTurns;
    const activeTalkTime = durationSeconds * 0.85; // Assume 15% silence/pauses
    agentTalkTime = Math.round(activeTalkTime * agentRatio);
    customerTalkTime = Math.round(activeTalkTime * (1 - agentRatio));
    silenceTime = Math.round(durationSeconds * 0.15);
    talkToListenRatio = customerTalkTime > 0 ? Number((agentTalkTime / customerTalkTime).toFixed(2)) : 0;
  }

  // Detect potential dead air (multiple newlines or "..." patterns)
  const deadAirPatterns = /\[silence\]|\[pause\]|\.\.\.|\n\n\n/gi;
  const deadAirMatches = transcript.match(deadAirPatterns) || [];

  // Detect interruptions (look for patterns like "— I" or cut-off speech)
  const interruptionPatterns = /—\s*[A-Z]|--\s*[A-Z]|\[interruption\]|\[cut.?off\]/gi;
  const interruptionMatches = transcript.match(interruptionPatterns) || [];

  return {
    agentTalkTime,
    customerTalkTime,
    silenceTime,
    talkToListenRatio,
    deadAirCount: deadAirMatches.length,
    interruptionCount: interruptionMatches.length,
  };
}
