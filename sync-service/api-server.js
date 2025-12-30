/**
 * Local API Server for Call Auditing
 *
 * Provides HTTP endpoints that the frontend can call to trigger
 * audio transcription and AI auditing using local tools.
 *
 * Usage:
 *   node api-server.js
 *
 * Endpoints:
 *   POST /api/audit/batch    - Process a batch of calls
 *   POST /api/audit/single   - Process a single call by ID
 *   GET  /api/status         - Get processing status
 *   GET  /api/health         - Health check
 */

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const config = {
  port: process.env.API_PORT || 3001,
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  lmstudio: {
    url: process.env.LMSTUDIO_URL || 'http://localhost:1234',
  },
  whisper: {
    model: process.env.WHISPER_MODEL || 'base',
  },
  processing: {
    maxDurationSeconds: 600,
    minDurationSeconds: 30,
  },
};

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Temp directory for audio files
const tempDir = path.join(os.tmpdir(), 'cliopa-audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Track processing state
let processingState = {
  isProcessing: false,
  currentBatch: null,
  processed: 0,
  successful: 0,
  failed: 0,
  lastRunAt: null,
  lastError: null,
};

/**
 * Check if LM Studio is available
 */
async function checkLMStudio() {
  try {
    const response = await fetch(`${config.lmstudio.url}/v1/models`, { timeout: 3000 });
    if (response.ok) {
      const data = await response.json();
      return { available: true, models: data.data?.map(m => m.id) || [] };
    }
    return { available: false };
  } catch {
    return { available: false };
  }
}

/**
 * Check what transcription method is available
 */
async function checkTranscriptionMethod() {
  // Try whisper CLI
  try {
    await execAsync('which whisper');
    return { method: 'cli', binary: 'whisper' };
  } catch {}

  try {
    await execAsync('which whisper-cpp');
    return { method: 'cli', binary: 'whisper-cpp' };
  } catch {}

  // Try macOS whisper via brew
  try {
    const { stdout } = await execAsync('brew --prefix whisper-cpp 2>/dev/null');
    const whisperPath = path.join(stdout.trim(), 'bin', 'whisper-cpp');
    if (fs.existsSync(whisperPath)) {
      return { method: 'cli', binary: whisperPath };
    }
  } catch {}

  return { method: 'none' };
}

/**
 * Download audio file from URL
 */
async function downloadAudio(url, callId) {
  try {
    const response = await fetch(url, { timeout: 60000 });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(url) || '.wav';
    const tempFile = path.join(tempDir, `${callId}${ext}`);

    fs.writeFileSync(tempFile, buffer);
    return { success: true, path: tempFile, size: buffer.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Transcribe audio using local Whisper CLI
 */
async function transcribeAudio(filePath, binary) {
  const outputDir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Convert to wav if needed using ffmpeg
  let wavPath = filePath;
  if (!filePath.endsWith('.wav')) {
    wavPath = path.join(outputDir, `${baseName}.wav`);
    try {
      await execAsync(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 "${wavPath}" -y`);
    } catch {
      wavPath = filePath;
    }
  }

  // Use Python Whisper syntax
  const cmd = `${binary} "${wavPath}" --model ${config.whisper.model} --language en --output_dir "${outputDir}" --output_format txt`;

  try {
    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout

    // Find the output file
    const possiblePaths = [
      path.join(outputDir, `${baseName}.txt`),
      path.join(outputDir, `${path.basename(wavPath, '.wav')}.txt`),
      `${wavPath}.txt`,
    ];

    for (const txtPath of possiblePaths) {
      if (fs.existsSync(txtPath)) {
        const transcript = fs.readFileSync(txtPath, 'utf-8');
        fs.unlinkSync(txtPath); // Cleanup
        return { success: true, transcript: transcript.trim() };
      }
    }

    return { success: false, error: 'Whisper output file not found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get default audit criteria
 */
function getDefaultCriteria() {
  return [
    { code: 'GREETING', name: 'Professional Greeting', description: 'Proper introduction, company name, agent identification' },
    { code: 'VERIFICATION', name: 'Identity Verification', description: 'Verified customer identity before discussing account' },
    { code: 'COMPLIANCE', name: 'Regulatory Compliance', description: 'Made required disclosures' },
    { code: 'TONE', name: 'Professional Tone', description: 'Maintained professional, courteous tone' },
    { code: 'EMPATHY', name: 'Empathy', description: 'Showed understanding of customer situation' },
    { code: 'RESOLUTION', name: 'Issue Resolution', description: 'Worked toward resolution or clear next steps' },
    { code: 'CLOSING', name: 'Professional Closing', description: 'Proper call closing' },
  ];
}

/**
 * Build audit prompt
 */
function buildAuditPrompt(transcript, criteria) {
  const criteriaList = criteria.map(c => `- ${c.code}: ${c.name} - ${c.description}`).join('\n');

  return `You are an expert call quality auditor. Analyze this call transcript.

CRITERIA:
${criteriaList}

TRANSCRIPT:
${transcript.slice(0, 10000)}

Return ONLY valid JSON:
{
  "overall_score": <0-100>,
  "summary": "<brief summary>",
  "communication_score": <0-100>,
  "compliance_score": <0-100>,
  "tone_score": <0-100>,
  "empathy_score": <0-100>,
  "resolution_score": <0-100>,
  "strengths": ["<strength>"],
  "areas_for_improvement": ["<area>"],
  "recommendations": ["<recommendation>"],
  "criteria": [{"id": "<code>", "result": "PASS|PARTIAL|FAIL", "explanation": "<why>", "recommendation": "<tip>"}]
}`;
}

/**
 * Parse audit response from LLM
 */
function parseAuditResponse(content) {
  try {
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    return JSON.parse(cleaned);
  } catch (err) {
    return { overall_score: 50, summary: 'Failed to parse response', criteria: [] };
  }
}

/**
 * Audit transcript using LM Studio
 */
async function auditWithLMStudio(transcript, customCriteria) {
  const criteria = customCriteria || getDefaultCriteria();
  const prompt = buildAuditPrompt(transcript, criteria);

  const response = await fetch(`${config.lmstudio.url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        { role: 'system', content: 'You are an expert call auditor. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio error: ${response.status}`);
  }

  const data = await response.json();
  return parseAuditResponse(data.choices?.[0]?.message?.content || '');
}

/**
 * Process a single call
 */
async function processCall(call, transcriptionMethod) {
  const startTime = Date.now();
  let tempFile = null;

  try {
    // Download audio
    const download = await downloadAudio(call.recording_url, call.call_id);
    if (!download.success) {
      return { success: false, error: `Download failed: ${download.error}` };
    }
    tempFile = download.path;

    // Transcribe
    const transcription = await transcribeAudio(tempFile, transcriptionMethod.binary);
    if (!transcription.success) {
      return { success: false, error: `Transcription failed: ${transcription.error}` };
    }

    if (transcription.transcript.length < 50) {
      return { success: false, error: 'Transcription too short' };
    }

    // Get template
    const { data: template } = await supabase
      .from('audit_templates')
      .select('criteria')
      .eq('is_default', true)
      .single();

    // Audit
    const auditResult = await auditWithLMStudio(transcription.transcript, template?.criteria);

    // Save transcript to call
    await supabase
      .from('calls')
      .update({ transcript_text: transcription.transcript, status: 'transcribed' })
      .eq('id', call.id);

    // Create report card
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const { data: reportCard, error: insertError } = await supabase
      .from('report_cards')
      .insert({
        user_id: call.user_id,
        call_id: call.id,
        source_file: call.call_id,
        source_type: 'call',
        overall_score: auditResult.overall_score,
        communication_score: auditResult.communication_score,
        compliance_score: auditResult.compliance_score,
        tone_score: auditResult.tone_score,
        empathy_score: auditResult.empathy_score,
        resolution_score: auditResult.resolution_score,
        feedback: auditResult.summary,
        strengths: auditResult.strengths || [],
        areas_for_improvement: auditResult.areas_for_improvement || [],
        recommendations: auditResult.recommendations || [],
        criteria_results: auditResult.criteria,
        ai_model: 'lm-studio-local',
        ai_provider: 'local',
        processing_time_ms: processingTime * 1000,
      })
      .select()
      .single();

    if (insertError) {
      return { success: false, error: `DB insert failed: ${insertError.message}` };
    }

    // Update call status
    await supabase
      .from('calls')
      .update({ status: 'audited', audit_id: reportCard.id })
      .eq('id', call.id);

    return { success: true, score: auditResult.overall_score, processingTime };

  } finally {
    // Cleanup temp file
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

// ==================== API ENDPOINTS ====================

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
  const lmStatus = await checkLMStudio();
  const whisperStatus = await checkTranscriptionMethod();

  res.json({
    status: 'ok',
    lmStudio: lmStatus,
    whisper: whisperStatus,
    processing: processingState.isProcessing,
  });
});

/**
 * Get current processing status
 */
app.get('/api/status', (req, res) => {
  res.json(processingState);
});

/**
 * Process a batch of calls
 */
app.post('/api/audit/batch', async (req, res) => {
  if (processingState.isProcessing) {
    return res.status(409).json({ error: 'Processing already in progress' });
  }

  const batchSize = req.body.batchSize || 10;

  // Check prerequisites
  const lmStatus = await checkLMStudio();
  if (!lmStatus.available) {
    return res.status(503).json({ error: 'LM Studio is not available. Please start LM Studio.' });
  }

  const whisperStatus = await checkTranscriptionMethod();
  if (whisperStatus.method === 'none') {
    return res.status(503).json({ error: 'No transcription method available. Please install Whisper.' });
  }

  // Get pending calls
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, recording_url, call_duration_seconds, campaign_name')
    .eq('status', 'pending')
    .not('recording_url', 'is', null)
    .gte('call_duration_seconds', config.processing.minDurationSeconds)
    .lte('call_duration_seconds', config.processing.maxDurationSeconds)
    .order('call_duration_seconds', { ascending: true })
    .limit(batchSize);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!calls || calls.length === 0) {
    return res.json({ success: true, processed: 0, message: 'No pending calls to process' });
  }

  // Start processing
  processingState = {
    isProcessing: true,
    currentBatch: calls.length,
    processed: 0,
    successful: 0,
    failed: 0,
    lastRunAt: new Date().toISOString(),
    lastError: null,
  };

  // Send immediate response
  res.json({ success: true, message: `Processing ${calls.length} calls`, batchId: Date.now() });

  // Process in background
  const results = [];
  for (const call of calls) {
    try {
      const result = await processCall(call, whisperStatus);
      results.push({ callId: call.call_id, ...result });

      processingState.processed++;
      if (result.success) {
        processingState.successful++;
      } else {
        processingState.failed++;
      }
    } catch (err) {
      results.push({ callId: call.call_id, success: false, error: err.message });
      processingState.processed++;
      processingState.failed++;
      processingState.lastError = err.message;
    }
  }

  processingState.isProcessing = false;
});

/**
 * Process a single call by ID
 */
app.post('/api/audit/single', async (req, res) => {
  const { callId } = req.body;

  if (!callId) {
    return res.status(400).json({ error: 'callId is required' });
  }

  // Check prerequisites
  const lmStatus = await checkLMStudio();
  if (!lmStatus.available) {
    return res.status(503).json({ error: 'LM Studio is not available' });
  }

  const whisperStatus = await checkTranscriptionMethod();
  if (whisperStatus.method === 'none') {
    return res.status(503).json({ error: 'No transcription method available' });
  }

  // Get the call
  const { data: call, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, recording_url, call_duration_seconds')
    .eq('id', callId)
    .single();

  if (error || !call) {
    return res.status(404).json({ error: 'Call not found' });
  }

  if (!call.recording_url) {
    return res.status(400).json({ error: 'Call has no recording URL' });
  }

  try {
    const result = await processCall(call, whisperStatus);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get pending calls count
 */
app.get('/api/calls/pending', async (req, res) => {
  const { data, error } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('recording_url', 'is', null)
    .gte('call_duration_seconds', config.processing.minDurationSeconds)
    .lte('call_duration_seconds', config.processing.maxDurationSeconds);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ count: data?.length || 0 });
});

// Start server
app.listen(config.port, () => {
  console.log('='.repeat(60));
  console.log('Cliopa Local Audit API Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${config.port}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /api/health        - Check service status`);
  console.log(`  GET  /api/status        - Get processing status`);
  console.log(`  POST /api/audit/batch   - Process batch of calls`);
  console.log(`  POST /api/audit/single  - Process single call`);
  console.log('');

  // Check prerequisites
  Promise.all([checkLMStudio(), checkTranscriptionMethod()]).then(([lm, whisper]) => {
    console.log('Prerequisites:');
    console.log(`  LM Studio: ${lm.available ? 'Available' : 'Not available'}`);
    console.log(`  Whisper: ${whisper.method !== 'none' ? whisper.binary : 'Not available'}`);
    console.log('');
  });
});
