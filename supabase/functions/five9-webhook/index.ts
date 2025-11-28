/**
 * Five9 Webhook Handler
 *
 * Receives call completion events from Five9 and stores them in the database.
 * Triggers automatic transcription and audit processing.
 *
 * Deploy: npx supabase functions deploy five9-webhook
 * URL: https://[project].supabase.co/functions/v1/five9-webhook
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Five9CallEvent {
  // Core Call Data
  callId: string;
  sessionId?: string;
  agentUserId?: string; // Five9 agent ID - we'll map to our user_id
  agentUsername?: string;
  agentEmail?: string;

  // Campaign Info
  campaignName?: string;
  callType?: "INBOUND" | "OUTBOUND" | "INTERNAL";

  // Timing
  callStartTime: string; // ISO 8601
  callEndTime: string;
  callDuration: number; // seconds

  // Customer Info
  customerPhone?: string;
  customerName?: string;
  ani?: string; // Automatic Number Identification

  // Recording
  recordingUrl?: string;
  recordingId?: string;

  // Call Outcome
  disposition?: string;
  wrapUpCode?: string;

  // Transcript (if Five9 provides it)
  transcriptText?: string;
  transcriptUrl?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Parse Five9 webhook payload
    const payload: Five9CallEvent = await req.json();

    console.log("Five9 webhook received:", payload.callId);

    // Map Five9 agent to our user_id
    // You can map by email, username, or external ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", payload.agentEmail || payload.agentUsername)
      .single();

    if (profileError || !profile) {
      console.error("Agent not found:", payload.agentEmail);
      return new Response(
        JSON.stringify({ error: "Agent not found in system" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate duration if not provided
    const duration =
      payload.callDuration ||
      Math.floor(
        (new Date(payload.callEndTime).getTime() - new Date(payload.callStartTime).getTime()) / 1000
      );

    // Insert call record
    const { data: call, error: insertError } = await supabase
      .from("calls")
      .insert({
        user_id: profile.id,
        call_id: payload.callId,
        campaign_name: payload.campaignName,
        call_type: payload.callType?.toLowerCase() || "inbound",
        call_start_time: payload.callStartTime,
        call_end_time: payload.callEndTime,
        call_duration_seconds: duration,
        recording_url: payload.recordingUrl,
        transcript_text: payload.transcriptText,
        transcript_url: payload.transcriptUrl,
        customer_phone: payload.customerPhone || payload.ani,
        customer_name: payload.customerName,
        disposition: payload.disposition || payload.wrapUpCode,
        status: payload.transcriptText ? "transcribed" : "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting call:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to store call", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Call stored successfully:", call.id);

    // If we don't have a transcript yet, trigger transcription
    if (!payload.transcriptText && payload.recordingUrl) {
      console.log("Triggering transcription for call:", call.id);

      // Invoke transcription edge function
      const { error: transcribeError } = await supabase.functions.invoke("transcribe-call", {
        body: { callId: call.id, recordingUrl: payload.recordingUrl },
      });

      if (transcribeError) {
        console.error("Failed to trigger transcription:", transcribeError);
      }
    }

    // If we have a transcript, trigger immediate audit and conversation analysis
    if (payload.transcriptText) {
      console.log("Triggering audit for call:", call.id);

      const { error: auditError } = await supabase.functions.invoke("audit-call", {
        body: { callId: call.id },
      });

      if (auditError) {
        console.error("Failed to trigger audit:", auditError);
      }

      // Trigger conversation intelligence analysis
      console.log("Triggering conversation analysis for call:", call.id);

      const { error: analysisError } = await supabase.functions.invoke("analyze-conversation", {
        body: { callId: call.id },
      });

      if (analysisError) {
        console.error("Failed to trigger conversation analysis:", analysisError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        callId: call.id,
        status: call.status,
        message: "Call received and processing initiated",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
