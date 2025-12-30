/**
 * Audio-to-Audit Processing Module
 *
 * Downloads call recordings from NAS, transcribes with Whisper,
 * and generates AI audits using LM Studio (free) or OpenAI (paid).
 *
 * Usage:
 *   node audio-audit.js --test              # Process 1 call with LM Studio
 *   node audio-audit.js --limit=10          # Process up to 10 calls
 *   node audio-audit.js --openai            # Use OpenAI instead of LM Studio
 *   node audio-audit.js --openai-whisper    # Use OpenAI Whisper for transcription
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  lmstudio: {
    url: process.env.LMSTUDIO_URL || 'http://localhost:1234',
  },
  processing: {
    maxDurationSeconds: 600, // Skip calls longer than 10 minutes
    minDurationSeconds: 30,  // Skip calls under 30 seconds (voicemails, hangups, etc.)
  },
};

// Initialize clients
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);
const openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null;

// Temp directory for audio files
const tempDir = path.join(os.tmpdir(), 'cliopa-audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Check if LM Studio is available
 */
async function checkLMStudio() {
  try {
    const response = await fetch(`${config.lmstudio.url}/v1/models`, {
      method: 'GET',
      timeout: 5000,
    });
    if (response.ok) {
      const data = await response.json();
      const models = data.data?.map(m => m.id) || [];
      console.log(`LM Studio available with models: ${models.join(', ') || 'none loaded'}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Main processing function
 */
async function processAudioAudits(options = {}) {
  const {
    limit = 5,
    testMode = false,
    useOpenAI = false,
    useOpenAIWhisper = false,
  } = options;

  console.log('='.repeat(60));
  console.log('Cliopa Audio-to-Audit Processor');
  console.log('='.repeat(60));
  console.log(`Mode: ${testMode ? 'TEST (1 call)' : `Processing up to ${limit} calls`}`);

  // Check AI provider availability
  let aiProvider = 'lmstudio';
  if (useOpenAI) {
    if (!config.openai.apiKey) {
      console.error('ERROR: OpenAI requested but OPENAI_API_KEY not set');
      process.exit(1);
    }
    aiProvider = 'openai';
    console.log('AI Provider: OpenAI (paid)');
  } else {
    const lmAvailable = await checkLMStudio();
    if (!lmAvailable) {
      console.log('\n⚠️  LM Studio not available at localhost:1234');
      console.log('   Start LM Studio and load a model, or use --openai flag\n');

      if (config.openai.apiKey) {
        console.log('Falling back to OpenAI...');
        aiProvider = 'openai';
      } else {
        console.error('ERROR: No AI provider available');
        process.exit(1);
      }
    } else {
      console.log('AI Provider: LM Studio (free/local)');
    }
  }

  // Transcription provider
  let whisperProvider = 'lmstudio';
  if (useOpenAIWhisper || !await checkLMStudioWhisper()) {
    if (config.openai.apiKey) {
      whisperProvider = 'openai';
      console.log('Transcription: OpenAI Whisper');
    } else {
      console.log('Transcription: LM Studio (if Whisper model loaded)');
    }
  } else {
    console.log('Transcription: LM Studio Whisper');
  }

  console.log('');

  // Get pending calls with recording URLs
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, recording_url, call_duration_seconds, campaign_name, status')
    .eq('status', 'pending')
    .not('recording_url', 'is', null)
    .gte('call_duration_seconds', config.processing.minDurationSeconds)
    .lte('call_duration_seconds', config.processing.maxDurationSeconds)
    .order('call_duration_seconds', { ascending: true }) // Start with shorter calls
    .limit(testMode ? 1 : limit);

  if (error) {
    console.error('Error fetching calls:', error.message);
    return { success: false, error: error.message };
  }

  if (!calls || calls.length === 0) {
    console.log('No pending calls to process.');
    return { success: true, processed: 0, message: 'No pending calls' };
  }

  console.log(`Found ${calls.length} calls to process\n`);

  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    details: [],
  };

  for (const call of calls) {
    console.log(`\n[${results.processed + 1}/${calls.length}] Processing call ${call.call_id}...`);
    console.log(`  Duration: ${call.call_duration_seconds}s | Campaign: ${call.campaign_name}`);

    try {
      const result = await processCall(call, { aiProvider, whisperProvider });
      results.processed++;

      if (result.success) {
        results.successful++;
        console.log(`  ✓ Score: ${result.score}/100 (${result.processingTime}s)`);
      } else {
        results.failed++;
        console.log(`  ✗ Failed: ${result.error}`);
      }

      results.details.push({
        call_id: call.call_id,
        ...result,
      });

    } catch (err) {
      results.processed++;
      results.failed++;
      console.log(`  ✗ Error: ${err.message}`);
      results.details.push({
        call_id: call.call_id,
        success: false,
        error: err.message,
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Processing Complete');
  console.log('='.repeat(60));
  console.log(`Processed: ${results.processed}`);
  console.log(`Successful: ${results.successful}`);
  console.log(`Failed: ${results.failed}`);

  return results;
}

/**
 * Check if LM Studio has a Whisper model loaded
 */
async function checkLMStudioWhisper() {
  // LM Studio doesn't have native Whisper support yet
  // This would need a separate Whisper server or we use OpenAI
  return false;
}

/**
 * Process a single call
 */
async function processCall(call, { aiProvider, whisperProvider }) {
  const startTime = Date.now();
  let tempFile = null;

  try {
    // Step 1: Download audio file
    console.log('  Downloading audio...');
    tempFile = await downloadAudio(call.recording_url, call.call_id);

    if (!tempFile) {
      throw new Error('Failed to download audio file');
    }

    // Step 2: Transcribe
    console.log('  Transcribing...');
    let transcript;

    if (whisperProvider === 'openai' && openai) {
      transcript = await transcribeWithOpenAI(tempFile);
    } else {
      // For LM Studio, we'd need a separate Whisper setup
      // Fall back to OpenAI if available
      if (openai) {
        transcript = await transcribeWithOpenAI(tempFile);
      } else {
        throw new Error('No transcription provider available');
      }
    }

    if (!transcript || transcript.length < 20) {
      throw new Error('Transcription failed or too short');
    }

    console.log(`  Transcript: ${transcript.length} chars`);

    // Step 3: Get audit template
    const { data: template } = await supabase
      .from('audit_templates')
      .select('criteria, name')
      .eq('is_default', true)
      .single();

    // Step 4: Audit
    console.log(`  Generating AI audit (${aiProvider})...`);
    let auditResult;

    if (aiProvider === 'openai') {
      auditResult = await auditWithOpenAI(transcript, template?.criteria);
    } else {
      auditResult = await auditWithLMStudio(transcript, template?.criteria);
    }

    // Step 5: Save transcript to call record
    await supabase
      .from('calls')
      .update({
        transcript_text: transcript,
        status: 'transcribed',
      })
      .eq('id', call.id);

    // Step 6: Create report card
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const { data: reportCard, error: reportError } = await supabase
      .from('report_cards')
      .insert({
        user_id: call.user_id,
        call_id: call.id,
        source_file: call.call_id || 'audio_audit',
        source_type: 'call',
        overall_score: auditResult.overall_score,
        communication_score: auditResult.communication_score || null,
        compliance_score: auditResult.compliance_score || null,
        accuracy_score: auditResult.accuracy_score || null,
        tone_score: auditResult.tone_score || null,
        empathy_score: auditResult.empathy_score || null,
        resolution_score: auditResult.resolution_score || null,
        feedback: auditResult.summary,
        strengths: auditResult.strengths || [],
        areas_for_improvement: auditResult.areas_for_improvement || [],
        recommendations: auditResult.recommendations || [],
        criteria_results: auditResult.criteria,
        ai_model: aiProvider === 'openai' ? 'gpt-4o-mini' : 'lm-studio-local',
        ai_provider: aiProvider,
        processing_time_ms: processingTime * 1000,
      })
      .select()
      .single();

    if (reportError) {
      throw new Error(`Failed to save report card: ${reportError.message}`);
    }

    // Step 7: Update call status
    await supabase
      .from('calls')
      .update({
        status: 'audited',
        audit_id: reportCard.id,
      })
      .eq('id', call.id);

    return {
      success: true,
      score: auditResult.overall_score,
      reportCardId: reportCard.id,
      processingTime,
    };

  } finally {
    // Cleanup temp file
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * Download audio file from NAS
 */
async function downloadAudio(url, callId) {
  try {
    const response = await fetch(url, { timeout: 60000 });

    if (!response.ok) {
      console.log(`  Warning: HTTP ${response.status} for ${url}`);
      return null;
    }

    const buffer = await response.buffer();
    const ext = path.extname(url) || '.wav';
    const tempFile = path.join(tempDir, `${callId}${ext}`);

    fs.writeFileSync(tempFile, buffer);
    console.log(`  Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    return tempFile;
  } catch (err) {
    console.log(`  Download error: ${err.message}`);
    return null;
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeWithOpenAI(filePath) {
  try {
    // Check file exists and get size
    const stats = fs.statSync(filePath);
    console.log(`  Audio file size: ${(stats.size / 1024).toFixed(1)} KB`);

    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'en',
      response_format: 'text',
    });

    return response;
  } catch (err) {
    // More detailed error logging
    console.log(`  Whisper error: ${err.message}`);
    if (err.status) {
      console.log(`  HTTP Status: ${err.status}`);
    }
    if (err.code) {
      console.log(`  Error code: ${err.code}`);
    }
    if (err.type) {
      console.log(`  Error type: ${err.type}`);
    }
    // Check for common issues
    if (err.message.includes('API key')) {
      console.log('  → Check your OPENAI_API_KEY in .env');
    }
    if (err.message.includes('rate') || err.message.includes('limit')) {
      console.log('  → Rate limited - wait a moment and retry');
    }
    if (err.message.includes('Connection') || err.code === 'ECONNREFUSED') {
      console.log('  → Network issue - check internet connection');
    }
    return null;
  }
}

/**
 * Audit transcript using LM Studio (FREE)
 */
async function auditWithLMStudio(transcript, customCriteria = null) {
  const criteria = customCriteria || getDefaultCriteria();
  const prompt = buildAuditPrompt(transcript, criteria);

  try {
    const response = await fetch(`${config.lmstudio.url}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model', // LM Studio uses whatever model is loaded
        messages: [
          {
            role: 'system',
            content: 'You are an expert call quality auditor. Analyze transcripts and return ONLY valid JSON. No markdown, no explanation, just the JSON object.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LM Studio');
    }

    return parseAuditResponse(content);

  } catch (err) {
    console.log(`  LM Studio error: ${err.message}`);
    return {
      overall_score: 50,
      summary: 'Unable to complete audit analysis',
      criteria: [],
    };
  }
}

/**
 * Audit transcript using OpenAI GPT-4o-mini (PAID but cheap)
 */
async function auditWithOpenAI(transcript, customCriteria = null) {
  const criteria = customCriteria || getDefaultCriteria();
  const prompt = buildAuditPrompt(transcript, criteria);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert call quality auditor. Provide detailed, constructive feedback in JSON format only.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    return JSON.parse(content);

  } catch (err) {
    console.log(`  OpenAI error: ${err.message}`);
    return {
      overall_score: 50,
      summary: 'Unable to complete audit analysis',
      criteria: [],
    };
  }
}

/**
 * Build the audit prompt
 */
function buildAuditPrompt(transcript, criteria) {
  const criteriaList = criteria.map(c =>
    `- ${c.code || c.id}: ${c.name} - ${c.description}`
  ).join('\n');

  return `You are an expert call quality auditor for a financial services company. Analyze this call transcript and provide a detailed quality assessment.

AUDIT CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript.slice(0, 10000)}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "overall_score": <number 0-100>,
  "summary": "<2-3 sentence summary of call quality>",
  "communication_score": <number 0-100>,
  "compliance_score": <number 0-100>,
  "tone_score": <number 0-100>,
  "empathy_score": <number 0-100>,
  "resolution_score": <number 0-100>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "areas_for_improvement": ["<area 1>", "<area 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"],
  "criteria": [
    {
      "id": "<criteria code>",
      "result": "PASS",
      "explanation": "<why this score>",
      "recommendation": "<specific improvement suggestion>"
    }
  ]
}

Scoring:
- PASS = Fully met criteria (100 points)
- PARTIAL = Partially met (50 points)
- FAIL = Did not meet criteria (0 points)
- Compliance issues should heavily impact overall_score

Return ONLY the JSON object.`;
}

/**
 * Parse LM Studio response (may have markdown or extra text)
 */
function parseAuditResponse(content) {
  try {
    // Remove markdown code blocks if present
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    // Try to find JSON object in the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);

    // Ensure required fields exist
    return {
      overall_score: parsed.overall_score || 50,
      summary: parsed.summary || 'No summary provided',
      communication_score: parsed.communication_score,
      compliance_score: parsed.compliance_score,
      tone_score: parsed.tone_score,
      empathy_score: parsed.empathy_score,
      resolution_score: parsed.resolution_score,
      strengths: parsed.strengths || [],
      areas_for_improvement: parsed.areas_for_improvement || [],
      recommendations: parsed.recommendations || [],
      criteria: parsed.criteria || [],
    };

  } catch (err) {
    console.log(`  Parse error: ${err.message}`);
    console.log(`  Raw response: ${content.slice(0, 200)}...`);
    return {
      overall_score: 50,
      summary: 'Failed to parse AI response',
      criteria: [],
    };
  }
}

/**
 * Default audit criteria if no template exists
 */
function getDefaultCriteria() {
  return [
    { code: 'GREETING', name: 'Professional Greeting', description: 'Proper introduction, company name, and agent identification' },
    { code: 'VERIFICATION', name: 'Identity Verification', description: 'Verified customer identity before discussing account details' },
    { code: 'COMPLIANCE', name: 'Regulatory Compliance', description: 'Made required disclosures (Mini-Miranda for collections, recording notice)' },
    { code: 'TONE', name: 'Professional Tone', description: 'Maintained professional, courteous, and respectful tone throughout' },
    { code: 'EMPATHY', name: 'Empathy & Understanding', description: 'Showed understanding of customer situation and concerns' },
    { code: 'LISTENING', name: 'Active Listening', description: 'Listened to customer without interrupting, addressed their concerns' },
    { code: 'ACCURACY', name: 'Information Accuracy', description: 'Provided accurate information about account, options, and next steps' },
    { code: 'RESOLUTION', name: 'Issue Resolution', description: 'Worked toward resolution or established clear next steps' },
    { code: 'CLOSING', name: 'Professional Closing', description: 'Summarized call, confirmed next steps, professional goodbye' },
  ];
}

// CLI handling
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const all = args.includes('--all');
  const useOpenAI = args.includes('--openai');
  const useOpenAIWhisper = args.includes('--openai-whisper') || args.includes('--openai');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : (all ? 1000 : 5);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Cliopa Audio-to-Audit Processor

Usage:
  node audio-audit.js [options]

Options:
  --test              Process just 1 call for testing
  --limit=N           Process up to N calls (default: 5)
  --all               Process all pending calls
  --openai            Use OpenAI for both transcription and audit (paid)
  --openai-whisper    Use OpenAI Whisper for transcription only
  --help              Show this help message

Examples:
  node audio-audit.js --test                    # Test with 1 call using LM Studio
  node audio-audit.js --limit=10                # Process 10 calls with LM Studio
  node audio-audit.js --openai --limit=5        # Process 5 calls with OpenAI

Requirements:
  - LM Studio running on localhost:1234 (for free local processing)
  - OR OPENAI_API_KEY in .env file (for paid cloud processing)
  - OpenAI Whisper is used for transcription (LM Studio doesn't have Whisper)
`);
    process.exit(0);
  }

  // Check for at least one provider
  const lmAvailable = await checkLMStudio();
  if (!lmAvailable && !config.openai.apiKey) {
    console.error('\n❌ ERROR: No AI provider available!\n');
    console.log('Options:');
    console.log('  1. Start LM Studio on localhost:1234');
    console.log('  2. Add OPENAI_API_KEY to sync-service/.env\n');
    process.exit(1);
  }

  // Whisper requires OpenAI (for now)
  if (!config.openai.apiKey) {
    console.error('\n❌ ERROR: OPENAI_API_KEY required for Whisper transcription\n');
    console.log('Add to sync-service/.env:');
    console.log('OPENAI_API_KEY=sk-your-key-here\n');
    console.log('Note: Transcription costs ~$0.006/minute');
    console.log('      Audit with LM Studio is FREE\n');
    process.exit(1);
  }

  const results = await processAudioAudits({
    limit,
    testMode,
    useOpenAI,
    useOpenAIWhisper,
  });

  process.exit(results.success === false ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

export { processAudioAudits, processCall };
