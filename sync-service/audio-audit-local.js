/**
 * Fully Local Audio-to-Audit Processing
 *
 * Uses local Whisper for transcription + LM Studio for audit.
 * NO OpenAI or cloud services required!
 *
 * Requirements:
 *   - whisper.cpp installed (brew install whisper-cpp) OR
 *   - Local Whisper server running
 *   - LM Studio running on port 1234
 *
 * Usage:
 *   node audio-audit-local.js --test      # Process 1 call
 *   node audio-audit-local.js --limit=10  # Process up to 10 calls
 */

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

// Configuration
const config = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  lmstudio: {
    url: process.env.LMSTUDIO_URL || 'http://localhost:1234',
  },
  whisper: {
    // Local whisper server (if running)
    serverUrl: process.env.WHISPER_SERVER_URL || 'http://localhost:9000',
    // Path to whisper.cpp binary (if installed)
    binaryPath: process.env.WHISPER_PATH || 'whisper',
    // Model to use (tiny, base, small, medium, large)
    model: process.env.WHISPER_MODEL || 'base',
  },
  processing: {
    maxDurationSeconds: 600,
    minDurationSeconds: 30,
  },
};

const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Temp directory
const tempDir = path.join(os.tmpdir(), 'cliopa-audio');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Check if LM Studio is available
 */
async function checkLMStudio() {
  try {
    const response = await fetch(`${config.lmstudio.url}/v1/models`);
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
  // Try local whisper server first
  try {
    const response = await fetch(`${config.whisper.serverUrl}/health`, { timeout: 2000 });
    if (response.ok) {
      return { method: 'server', url: config.whisper.serverUrl };
    }
  } catch {}

  // Try whisper.cpp CLI
  try {
    await execAsync('which whisper || where whisper');
    return { method: 'cli', binary: 'whisper' };
  } catch {}

  // Try whisper-cpp specifically
  try {
    await execAsync('which whisper-cpp || where whisper-cpp');
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
 * Transcribe audio using local whisper server
 */
async function transcribeWithServer(filePath) {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(filePath)]), 'audio.wav');
  formData.append('model', config.whisper.model);
  formData.append('language', 'en');

  const response = await fetch(`${config.whisper.serverUrl}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Whisper server error: ${response.status}`);
  }

  const result = await response.json();
  return result.text || result.transcription;
}

/**
 * Transcribe audio using whisper CLI (OpenAI Python version or whisper.cpp)
 */
async function transcribeWithCLI(filePath, binary) {
  const outputDir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));

  // Convert to wav if needed
  let wavPath = filePath;
  if (!filePath.endsWith('.wav')) {
    wavPath = path.join(outputDir, `${baseName}.wav`);
    try {
      await execAsync(`ffmpeg -i "${filePath}" -ar 16000 -ac 1 "${wavPath}" -y`);
    } catch {
      wavPath = filePath;
    }
  }

  // Try to detect which whisper version we have
  let cmd;
  try {
    // Check if it's OpenAI's Python whisper
    const { stdout } = await execAsync(`${binary} --help 2>&1 | head -5`);
    if (stdout.includes('output_dir') || stdout.includes('output_format')) {
      // OpenAI Python Whisper - use --output_dir and --output_format
      cmd = `${binary} "${wavPath}" --model ${config.whisper.model} --language en --output_dir "${outputDir}" --output_format txt`;
    } else {
      // whisper.cpp style
      cmd = `${binary} -m models/ggml-${config.whisper.model}.bin -f "${wavPath}" -otxt`;
    }
  } catch {
    // Default to Python whisper syntax
    cmd = `${binary} "${wavPath}" --model ${config.whisper.model} --language en --output_dir "${outputDir}" --output_format txt`;
  }

  console.log(`  Running: ${cmd.slice(0, 80)}...`);

  try {
    await execAsync(cmd, { timeout: 300000 }); // 5 min timeout for longer files

    // Find the output file - Python whisper names it based on input file
    const possiblePaths = [
      path.join(outputDir, `${baseName}.txt`),
      path.join(outputDir, `${path.basename(wavPath, '.wav')}.txt`),
      `${wavPath}.txt`,
    ];

    for (const txtPath of possiblePaths) {
      if (fs.existsSync(txtPath)) {
        const transcript = fs.readFileSync(txtPath, 'utf-8');
        fs.unlinkSync(txtPath); // Cleanup
        return transcript.trim();
      }
    }

    // List files in output dir to debug
    const files = fs.readdirSync(outputDir);
    console.log(`  Files in output dir: ${files.filter(f => f.includes(baseName)).join(', ')}`);

    throw new Error('Whisper output file not found');
  } catch (err) {
    throw new Error(`Whisper CLI error: ${err.message}`);
  }
}

/**
 * Transcribe audio file
 */
async function transcribeAudio(filePath, method) {
  if (method.method === 'server') {
    return transcribeWithServer(filePath);
  } else if (method.method === 'cli') {
    return transcribeWithCLI(filePath, method.binary);
  }
  throw new Error('No transcription method available');
}

/**
 * Download audio file
 */
async function downloadAudio(url, callId) {
  try {
    const response = await fetch(url, { timeout: 60000 });
    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
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
 * Get default criteria
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
 * Parse audit response
 */
function parseAuditResponse(content) {
  try {
    let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];
    return JSON.parse(cleaned);
  } catch (err) {
    console.log(`  Parse error: ${err.message}`);
    return { overall_score: 50, summary: 'Failed to parse', criteria: [] };
  }
}

/**
 * Audit with LM Studio
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
    // Download
    console.log('  Downloading audio...');
    tempFile = await downloadAudio(call.recording_url, call.call_id);
    if (!tempFile) throw new Error('Download failed');

    // Transcribe
    console.log('  Transcribing locally...');
    const transcript = await transcribeAudio(tempFile, transcriptionMethod);
    if (!transcript || transcript.length < 50) {
      throw new Error('Transcription too short or failed');
    }
    console.log(`  Transcript: ${transcript.length} chars`);

    // Get template
    const { data: template } = await supabase
      .from('audit_templates')
      .select('criteria')
      .eq('is_default', true)
      .single();

    // Audit
    console.log('  Auditing with LM Studio...');
    const auditResult = await auditWithLMStudio(transcript, template?.criteria);

    // Save transcript
    await supabase
      .from('calls')
      .update({ transcript_text: transcript, status: 'transcribed' })
      .eq('id', call.id);

    // Create report card
    const processingTime = Math.round((Date.now() - startTime) / 1000);

    const { data: reportCard, error } = await supabase
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

    if (error) throw new Error(error.message);

    // Update call
    await supabase
      .from('calls')
      .update({ status: 'audited', audit_id: reportCard.id })
      .eq('id', call.id);

    return { success: true, score: auditResult.overall_score, processingTime };

  } finally {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : (testMode ? 1 : 5);

  console.log('='.repeat(60));
  console.log('Fully Local Audio-to-Audit Processor');
  console.log('='.repeat(60));
  console.log('');

  // Check LM Studio
  const lm = await checkLMStudio();
  if (!lm.available) {
    console.log('❌ LM Studio not available!');
    console.log('   Start LM Studio on port 1234 and load a model.');
    process.exit(1);
  }
  console.log(`✓ LM Studio: ${lm.models.join(', ')}`);

  // Check transcription
  const transcription = await checkTranscriptionMethod();
  if (transcription.method === 'none') {
    console.log('');
    console.log('❌ No local transcription available!');
    console.log('');
    console.log('Install one of these:');
    console.log('');
    console.log('  Option 1: whisper.cpp (recommended for Mac)');
    console.log('    brew install whisper-cpp');
    console.log('');
    console.log('  Option 2: Local Whisper server');
    console.log('    pip install faster-whisper');
    console.log('    # Then run a whisper server on port 9000');
    console.log('');
    console.log('  Option 3: Use OpenAI Whisper (paid)');
    console.log('    node audio-audit.js --test');
    console.log('');
    process.exit(1);
  }
  console.log(`✓ Transcription: ${transcription.method} (${transcription.binary || transcription.url})`);
  console.log('');

  // Get calls
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, recording_url, call_duration_seconds, campaign_name')
    .eq('status', 'pending')
    .not('recording_url', 'is', null)
    .gte('call_duration_seconds', config.processing.minDurationSeconds)
    .lte('call_duration_seconds', config.processing.maxDurationSeconds)
    .order('call_duration_seconds', { ascending: true })
    .limit(limit);

  if (error) {
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }

  if (!calls || calls.length === 0) {
    console.log('No pending calls to process.');
    process.exit(0);
  }

  console.log(`Found ${calls.length} calls to process\n`);

  let successful = 0;
  let failed = 0;

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    console.log(`[${i + 1}/${calls.length}] Call ${call.call_id} (${call.call_duration_seconds}s)`);

    try {
      const result = await processCall(call, transcription);
      console.log(`  ✓ Score: ${result.score}/100 (${result.processingTime}s)`);
      successful++;
    } catch (err) {
      console.log(`  ✗ ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`Done! ${successful} successful, ${failed} failed`);
}

main().catch(console.error);
