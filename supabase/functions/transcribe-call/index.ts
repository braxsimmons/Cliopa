/**
 * Call Transcription Service
 *
 * Downloads call recording from Five9 and transcribes it using OpenAI Whisper.
 * Updates the calls table with transcript text.
 *
 * Deploy: npx supabase functions deploy transcribe-call
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TranscribeRequest {
  callId: string;
  recordingUrl: string;
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { callId, recordingUrl }: TranscribeRequest = await req.json();

    console.log("Transcribing call:", callId);

    // Download audio file from Five9
    const audioResponse = await fetch(recordingUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to download recording");
    }

    const audioBlob = await audioResponse.blob();
    const audioArrayBuffer = await audioBlob.arrayBuffer();

    // Prepare form data for Whisper API
    const formData = new FormData();
    formData.append("file", new Blob([audioArrayBuffer]), "recording.mp3");
    formData.append("model", "whisper-1");
    formData.append("language", "en");
    formData.append("response_format", "verbose_json"); // Get timestamps

    // Call OpenAI Whisper API
    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const error = await whisperResponse.text();
      throw new Error(`Whisper API error: ${error}`);
    }

    const transcription = await whisperResponse.json();
    const transcriptText = transcription.text;

    console.log("Transcription complete, length:", transcriptText.length);

    // Update call record with transcript
    const { error: updateError } = await supabase
      .from("calls")
      .update({
        transcript_text: transcriptText,
        status: "transcribed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);

    if (updateError) {
      console.error("Failed to update call:", updateError);
      throw new Error("Failed to update call with transcript");
    }

    // Trigger audit automatically
    console.log("Triggering audit for transcribed call:", callId);
    const { error: auditError } = await supabase.functions.invoke("audit-call", {
      body: { callId },
    });

    if (auditError) {
      console.error("Failed to trigger audit:", auditError);
    }

    // Trigger conversation intelligence analysis
    console.log("Triggering conversation analysis for call:", callId);
    const { error: analysisError } = await supabase.functions.invoke("analyze-conversation", {
      body: { callId },
    });

    if (analysisError) {
      console.error("Failed to trigger conversation analysis:", analysisError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        callId,
        transcriptLength: transcriptText.length,
        message: "Transcription complete, audit and analysis triggered",
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
