/**
 * Cliopa Call Sync Service
 *
 * HTTP server that syncs call recordings from SQL Server (Five9 data) to Supabase.
 * Runs on port 8080 and provides API endpoints for sync control.
 *
 * Usage:
 *   npm run sync          - Start HTTP server with background sync
 *   npm run sync:once     - Run once and exit (no server)
 */

import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const config = {
  server: {
    port: parseInt(process.env.SYNC_PORT || '8082'),
  },
  mssql: {
    server: process.env.MSSQL_SERVER,
    database: process.env.MSSQL_DATABASE,
    user: process.env.MSSQL_USERNAME,
    password: process.env.MSSQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || '15'),
    batchSize: parseInt(process.env.SYNC_BATCH_SIZE || '50'),
    lookbackHours: parseInt(process.env.SYNC_LOOKBACK_HOURS || '24'),
  },
};

// Initialize Supabase client
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

// Sync state tracking
const syncState = {
  isRunning: false,
  lastSync: null,
  lastResult: null,
  totalSynced: 0,
  totalErrors: 0,
  agentsCreated: 0,
};

// SQL Query for call recordings
const CALL_QUERY = `
SELECT
  recording_id,
  upload_timestamp,
  file_name,
  call_timestamp,
  length_seconds,
  call_type,
  number1,
  email,
  first_name,
  last_name,
  inf_cust_id,
  disposition,
  campaign,
  agent_name,
  agent_email,
  agent_group,
  deleted,
  status,
  call_id,
  server_name,
  file_path,
  CASE
    WHEN server_name = 'F9' THEN CONCAT(
      'https://nas01.tlcops.com/Five9VmBackup/',
      file_path,
      file_name
    )
    ELSE CONCAT(
      'https://nas01.tlcops.com',
      file_path,
      file_name
    )
  END AS recording_link,
  CASE
    WHEN server_name = 'F9' AND call_id IS NOT NULL THEN
      CONCAT(
        'https://nas01.tlcops.com/Five9VmBackup/',
        REPLACE(file_path, 'recordings', 'summaries'),
        call_id,
        '_',
        agent_email,
        '_summary.txt'
      )
    WHEN server_name = 'F9' THEN
      CONCAT(
        'https://nas01.tlcops.com/Five9VmBackup/',
        REPLACE(file_path, 'recordings', 'summaries'),
        LEFT(file_name, CHARINDEX('_', file_name) - 1),
        '_',
        agent_email,
        '_summary.txt'
      )
    ELSE ''
  END AS summary_link,
  CASE
    WHEN server_name = 'F9' AND call_id IS NOT NULL THEN
      CONCAT(
        'https://nas01.tlcops.com/Five9VmBackup/',
        REPLACE(file_path, 'recordings', 'transcripts'),
        call_id,
        '_',
        agent_email,
        '_transcript.txt'
      )
    WHEN server_name = 'F9' THEN
      CONCAT(
        'https://nas01.tlcops.com/Five9VmBackup/',
        REPLACE(file_path, 'recordings', 'transcripts'),
        LEFT(file_name, CHARINDEX('_', file_name) - 1),
        '_',
        agent_email,
        '_transcript.txt'
      )
    ELSE ''
  END AS transcript_link
FROM fivenine.call_recording_logs
WHERE
  upload_timestamp >= @lookbackDate
  AND deleted = 0
  AND agent_email IS NOT NULL
  AND agent_email != ''
ORDER BY upload_timestamp DESC
`;

// Cache for agent profiles
const agentCache = new Map();

// ============================================================================
// EXPRESS SERVER
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get sync status
app.get('/status', async (req, res) => {
  // Get counts from database
  const { data: callCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true });

  const { data: pendingCalls } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'transcribed']);

  const { data: auditedCalls } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'audited');

  res.json({
    ...syncState,
    database: {
      totalCalls: callCount?.length || 0,
      pendingCalls: pendingCalls?.length || 0,
      auditedCalls: auditedCalls?.length || 0,
    },
    config: {
      intervalMinutes: config.sync.intervalMinutes,
      lookbackHours: config.sync.lookbackHours,
      batchSize: config.sync.batchSize,
    },
  });
});

// Trigger manual sync
app.post('/sync', async (req, res) => {
  const { limit } = req.body || {};

  if (syncState.isRunning) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  // Run sync in background
  syncCalls(limit).catch(console.error);

  res.json({ message: 'Sync started', limit: limit || 'unlimited' });
});

// Get recent sync logs
app.get('/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('call_sync_logs')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Get agents with call counts
app.get('/agents', async (req, res) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      first_name,
      last_name,
      team,
      role,
      calls:calls(count)
    `)
    .eq('role', 'agent');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Trigger AI audit for pending calls
app.post('/audit', async (req, res) => {
  const { limit = 3 } = req.body || {};

  try {
    console.log(`\n[AUDIT] Processing up to ${limit} calls...`);
    const result = await processCallsWithAI(limit);
    res.json({ message: 'Audit complete', ...result });
  } catch (error) {
    console.error('[AUDIT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get pending calls ready for audit
app.get('/pending', async (req, res) => {
  const { data, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, transcript_text, status, call_duration_seconds, campaign_name, created_at')
    .in('status', ['pending', 'transcribed'])
    .not('transcript_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    count: data.length,
    calls: data.map(c => ({
      id: c.id,
      call_id: c.call_id,
      status: c.status,
      duration: c.call_duration_seconds,
      campaign: c.campaign_name,
      hasTranscript: !!c.transcript_text,
      transcriptLength: c.transcript_text?.length || 0,
    }))
  });
});

// Debug: Get ALL calls (no filters)
app.get('/debug/calls', async (req, res) => {
  const { data, error } = await supabase
    .from('calls')
    .select('id, call_id, status, transcript_text, transcript_url, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({
    count: data.length,
    calls: data.map(c => ({
      id: c.id,
      call_id: c.call_id,
      status: c.status,
      hasTranscript: !!c.transcript_text,
      transcriptLength: c.transcript_text?.length || 0,
      transcript_url: c.transcript_url,
    }))
  });
});

// ============================================================================
// SYNC FUNCTIONS
// ============================================================================

async function syncCalls(limit = null) {
  if (syncState.isRunning) {
    console.log('Sync already in progress, skipping...');
    return { skipped: true };
  }

  syncState.isRunning = true;
  console.log(`\n[${new Date().toISOString()}] Starting call sync...`);

  let pool;
  try {
    console.log('Connecting to SQL Server...');
    pool = await sql.connect(config.mssql);
    console.log('Connected to SQL Server');

    const lookbackDate = new Date();
    lookbackDate.setHours(lookbackDate.getHours() - config.sync.lookbackHours);

    console.log(`Fetching calls since ${lookbackDate.toISOString()}...`);
    const result = await pool.request()
      .input('lookbackDate', sql.DateTime, lookbackDate)
      .query(CALL_QUERY);

    let calls = result.recordset;
    console.log(`Found ${calls.length} calls in SQL Server`);

    if (calls.length === 0) {
      console.log('No new calls to sync');
      syncState.lastSync = new Date().toISOString();
      syncState.lastResult = { synced: 0, skipped: 0, errors: 0 };
      return syncState.lastResult;
    }

    const existingCallIds = await getExistingCallIds(calls.map(c => c.call_id || c.recording_id));
    calls = calls.filter(c => !existingCallIds.has(c.call_id || c.recording_id));
    console.log(`${calls.length} new calls to sync (${existingCallIds.size} already synced)`);

    if (limit && calls.length > limit) {
      console.log(`Limiting to ${limit} calls`);
      calls = calls.slice(0, limit);
    }

    let synced = 0;
    let errors = 0;

    for (let i = 0; i < calls.length; i += config.sync.batchSize) {
      const batch = calls.slice(i, i + config.sync.batchSize);
      console.log(`Processing batch ${Math.floor(i / config.sync.batchSize) + 1}/${Math.ceil(calls.length / config.sync.batchSize)}`);

      for (const call of batch) {
        try {
          await processCall(call);
          synced++;
          syncState.totalSynced++;
        } catch (error) {
          console.error(`Error processing call ${call.call_id || call.recording_id}:`, error.message);
          errors++;
          syncState.totalErrors++;
        }
      }
    }

    const syncResult = { synced, skipped: existingCallIds.size, errors };
    console.log(`Sync complete: ${synced} synced, ${existingCallIds.size} skipped, ${errors} errors`);

    syncState.lastSync = new Date().toISOString();
    syncState.lastResult = syncResult;

    return syncResult;

  } catch (error) {
    console.error('Sync error:', error);
    syncState.lastResult = { error: error.message };
    throw error;
  } finally {
    syncState.isRunning = false;
    if (pool) {
      await pool.close();
    }
  }
}

async function getExistingCallIds(callIds) {
  const validIds = callIds.filter(Boolean);
  const existingIds = new Set();
  const batchSize = 100;

  for (let i = 0; i < validIds.length; i += batchSize) {
    const batch = validIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('calls')
      .select('call_id')
      .in('call_id', batch);

    if (error) {
      console.error('Error fetching existing calls batch:', error.message);
      continue;
    }

    data.forEach(c => existingIds.add(c.call_id));
  }

  return existingIds;
}

async function processCall(call) {
  const callId = call.call_id || call.recording_id;
  console.log(`  Processing: ${callId} (${call.agent_email})`);

  const agentId = await findAgent(call.agent_email, call.agent_name);
  if (!agentId) {
    throw new Error(`Agent not found: ${call.agent_email}`);
  }

  let transcriptText = null;
  if (call.transcript_link) {
    transcriptText = await fetchTextFile(call.transcript_link, 'transcript');
  }

  let summaryText = null;
  if (call.summary_link) {
    summaryText = await fetchTextFile(call.summary_link, 'summary');
  }

  const { error: insertError } = await supabase
    .from('calls')
    .insert({
      user_id: agentId,
      call_id: callId,
      campaign_name: call.campaign,
      call_type: mapCallType(call.call_type),
      call_start_time: call.call_timestamp,
      call_duration_seconds: call.length_seconds,
      recording_url: call.recording_link,
      transcript_text: transcriptText,
      transcript_url: call.transcript_link,
      summary_url: call.summary_link,
      summary_text: summaryText,
      customer_phone: call.number1,
      customer_name: [call.first_name, call.last_name].filter(Boolean).join(' ') || null,
      disposition: call.disposition,
      status: transcriptText ? 'transcribed' : 'pending',
      processing_status: transcriptText ? 'queued' : 'pending',
    });

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  await logSyncEvent(callId, 'success', null);
}

async function findAgent(email, agentName = null) {
  if (!email) return null;

  if (agentCache.has(email)) {
    return agentCache.get(email);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    const { data: altData } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', `%${email.split('@')[0]}%`);

    if (altData && altData.length === 1) {
      agentCache.set(email, altData[0].id);
      return altData[0].id;
    }

    console.log(`    Creating new agent: ${email}`);
    const newAgent = await createAgent(email, agentName);
    if (newAgent) {
      agentCache.set(email, newAgent.id);
      syncState.agentsCreated++;
      return newAgent.id;
    }

    return null;
  }

  agentCache.set(email, data.id);
  return data.id;
}

async function createAgent(email, agentName) {
  let firstName = '';
  let lastName = '';

  if (agentName) {
    const parts = agentName.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  } else {
    const username = email.split('@')[0];
    const nameParts = username.split(/[._-]/);
    firstName = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : '';
    lastName = nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : '';
  }

  const domain = email.split('@')[1] || '';
  let team = '';
  if (domain.includes('boostcreditline')) team = 'Boost';
  else if (domain.includes('bisongreen')) team = 'Bison';
  else if (domain.includes('tlc')) team = 'TLC';
  else if (domain.includes('yattaops')) team = 'Yatta';

  try {
    const tempPassword = `Temp${Date.now()}!${Math.random().toString(36).slice(2, 10)}`;

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        created_by_sync: true,
      },
    });

    if (authError) {
      console.error(`    Error creating auth user: ${authError.message}`);
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        role: 'agent',
        team: team || null,
        hourly_rate: 15.00,
      }, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      return { id: authUser.user.id };
    }

    console.log(`    Created: ${firstName} ${lastName} (${email}) - Team: ${team || 'Unassigned'}`);
    return profile;

  } catch (error) {
    console.error(`    Unexpected error: ${error.message}`);
    return null;
  }
}

async function fetchTextFile(url, type = 'file') {
  if (!url || url === '') return null;

  try {
    const response = await fetch(url, { timeout: 30000 });
    if (!response.ok) return null;

    const text = await response.text();
    return text && text.length >= 10 ? text : null;
  } catch {
    return null;
  }
}

function mapCallType(type) {
  if (!type) return 'inbound';
  const lower = type.toLowerCase();
  if (lower.includes('outbound') || lower.includes('out')) return 'outbound';
  if (lower.includes('internal') || lower.includes('int')) return 'internal';
  return 'inbound';
}

async function logSyncEvent(callId, status, error) {
  try {
    await supabase.from('call_sync_logs').insert({
      call_id: callId,
      status,
      error_message: error,
      synced_at: new Date().toISOString(),
    });
  } catch {
    // Ignore
  }
}

/**
 * Process pending calls with LM Studio AI
 */
async function processCallsWithAI(limit = 3) {
  // Check if LM Studio is available
  const lmStudioAvailable = await checkLMStudio();
  if (!lmStudioAvailable) {
    throw new Error('LM Studio not available. Start it on port 1234.');
  }

  // Get pending calls with transcripts
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, call_id, user_id, transcript_text, campaign_name')
    .in('status', ['pending', 'transcribed'])
    .not('transcript_text', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch calls: ${error.message}`);
  }

  if (!calls || calls.length === 0) {
    return { processed: 0, message: 'No pending calls with transcripts' };
  }

  console.log(`[AUDIT] Found ${calls.length} calls to process`);

  let processed = 0;
  let failed = 0;
  const results = [];

  for (const call of calls) {
    try {
      console.log(`[AUDIT] Processing call ${call.call_id}...`);
      const startTime = Date.now();

      // Send to LM Studio
      const auditResult = await auditWithLMStudio(call.transcript_text);
      const processingTime = Date.now() - startTime;

      // Save report card
      const { error: insertError } = await supabase
        .from('report_cards')
        .insert({
          user_id: call.user_id,
          call_id: call.id,
          source_file: call.call_id || 'synced_call',
          source_type: 'call',
          overall_score: auditResult.overall_score,
          communication_score: auditResult.communication_score || null,
          compliance_score: auditResult.compliance_score || null,
          accuracy_score: auditResult.accuracy_score || null,
          tone_score: auditResult.tone_score || null,
          empathy_score: auditResult.empathy_score || null,
          resolution_score: auditResult.resolution_score || null,
          feedback: auditResult.summary,
          strengths: auditResult.criteria?.filter(c => c.result === 'PASS').map(c => c.explanation).slice(0, 5) || [],
          areas_for_improvement: auditResult.criteria?.filter(c => c.result !== 'PASS').map(c => c.explanation).slice(0, 5) || [],
          recommendations: auditResult.criteria?.filter(c => c.result !== 'PASS').map(c => c.recommendation).filter(Boolean).slice(0, 5) || [],
          criteria_results: auditResult.criteria,
          ai_model: 'lm-studio-local',
          ai_provider: 'lm-studio',
          processing_time_ms: processingTime,
        });

      if (insertError) {
        console.error(`[AUDIT] Failed to save report card: ${insertError.message}`);
        failed++;
        continue;
      }

      // Update call status
      await supabase
        .from('calls')
        .update({ status: 'audited' })
        .eq('id', call.id);

      console.log(`[AUDIT] ✓ Call ${call.call_id} - Score: ${auditResult.overall_score} (${(processingTime/1000).toFixed(1)}s)`);
      processed++;
      results.push({
        call_id: call.call_id,
        score: auditResult.overall_score,
        processing_time_ms: processingTime,
      });

    } catch (err) {
      console.error(`[AUDIT] ✗ Failed to process ${call.call_id}:`, err.message);
      failed++;
    }
  }

  return { processed, failed, results };
}

/**
 * Check if LM Studio is running
 */
async function checkLMStudio() {
  try {
    const response = await fetch('http://localhost:1234/v1/models', {
      method: 'GET',
      timeout: 5000,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send transcript to LM Studio for audit
 */
async function auditWithLMStudio(transcript) {
  const prompt = buildAuditPrompt(transcript);

  const response = await fetch('http://localhost:1234/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model',
      messages: [
        {
          role: 'system',
          content: 'You are an expert call quality auditor. Analyze transcripts and return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from LM Studio');

  return parseAuditResponse(content);
}

/**
 * Build audit prompt
 */
function buildAuditPrompt(transcript) {
  return `
AUDIT THIS CALL TRANSCRIPT:

CRITERIA TO EVALUATE:
- QQ: Qualifying Questions - Were proper qualifying questions asked?
- VCI: Verification - Was customer identity verified?
- COMPLIANCE: Were required disclosures made?
- TONE: Was the agent professional and courteous?
- EMPATHY: Did the agent show understanding?
- RESOLUTION: Was the issue resolved or next steps clear?

TRANSCRIPT:
${transcript.slice(0, 8000)}

RETURN STRICT JSON ONLY:
{
  "overall_score": number (0-100),
  "summary": "Brief assessment of the call",
  "criteria": [
    { "id": "QQ", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." },
    { "id": "VCI", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." },
    { "id": "COMPLIANCE", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." },
    { "id": "TONE", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." },
    { "id": "EMPATHY", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." },
    { "id": "RESOLUTION", "result": "PASS" | "PARTIAL" | "FAIL", "explanation": "...", "recommendation": "..." }
  ]
}
  `.trim();
}

/**
 * Parse LM Studio response
 */
function parseAuditResponse(content) {
  try {
    const cleaned = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Calculate dimensional scores from criteria
    const scores = calculateScores(parsed.criteria || []);

    return {
      ...parsed,
      ...scores,
    };
  } catch (err) {
    console.error('Failed to parse audit response:', err.message);
    // Return minimal valid result
    return {
      overall_score: 50,
      summary: 'Unable to parse AI response',
      criteria: [],
    };
  }
}

/**
 * Calculate dimensional scores from criteria
 */
function calculateScores(criteria) {
  const scoreFor = (ids) => {
    const matches = criteria.filter(c => ids.includes(c.id));
    if (matches.length === 0) return null;
    const total = matches.reduce((acc, c) => {
      return acc + (c.result === 'PASS' ? 100 : c.result === 'PARTIAL' ? 50 : 0);
    }, 0);
    return Math.round(total / matches.length);
  };

  return {
    communication_score: scoreFor(['TONE']),
    compliance_score: scoreFor(['QQ', 'VCI', 'COMPLIANCE']),
    accuracy_score: scoreFor(['VCI']),
    tone_score: scoreFor(['TONE']),
    empathy_score: scoreFor(['EMPATHY']),
    resolution_score: scoreFor(['RESOLUTION']),
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const runOnce = process.argv.includes('--once');
  const testMode = process.argv.includes('--test');
  const serverOnly = process.argv.includes('--server'); // Just start server, no auto-sync
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const testLimit = limitArg ? parseInt(limitArg.split('=')[1]) : (testMode ? 3 : null);

  console.log('='.repeat(60));
  console.log('Cliopa Call Sync Service');
  console.log('='.repeat(60));
  console.log(`SQL Server: ${config.mssql.server}/${config.mssql.database}`);
  console.log(`Supabase: ${config.supabase.url}`);
  if (!serverOnly) {
    console.log(`Sync interval: ${config.sync.intervalMinutes} minutes`);
    console.log(`Lookback: ${config.sync.lookbackHours} hours`);
  }
  console.log('='.repeat(60));

  if (runOnce || testMode) {
    // CLI mode - run once and exit
    if (testMode || testLimit) {
      console.log(`🧪 TEST MODE - Limit: ${testLimit || 3} calls`);
    }
    await syncCalls(testLimit || (testMode ? 3 : null));
    console.log('Done.');
    process.exit(0);
  } else {
    // Server mode - start HTTP server
    app.listen(config.server.port, () => {
      console.log(`\n🚀 Sync server running on http://localhost:${config.server.port}`);
      console.log('\nEndpoints:');
      console.log('  GET  /health   - Health check');
      console.log('  GET  /status   - Sync status & stats');
      console.log('  GET  /pending  - List pending calls with transcripts');
      console.log('  POST /sync     - Trigger manual sync (body: {limit: N})');
      console.log('  POST /audit    - Trigger AI audit (body: {limit: N})');
      console.log('  GET  /logs     - Recent sync logs');
      console.log('  GET  /agents   - List agents with call counts\n');
    });

    if (serverOnly) {
      console.log('📡 Server-only mode - no automatic syncing');
      console.log('Use POST /sync or POST /audit to manually trigger\n');
    } else {
      // Initial sync
      console.log('Running initial sync...');
      await syncCalls();

      // Schedule recurring syncs
      const intervalMs = config.sync.intervalMinutes * 60 * 1000;
      setInterval(async () => {
        try {
          await syncCalls();
        } catch (error) {
          console.error('Scheduled sync failed:', error.message);
        }
      }, intervalMs);

      console.log(`\nBackground sync scheduled every ${config.sync.intervalMinutes} minutes`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
