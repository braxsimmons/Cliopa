# Five9 Integration - Deployment Steps

## Current Status
✅ Agent dropdown now shows all users
✅ AI Audit Tool is working
✅ Database migration complete
✅ Edge Functions created (five9-webhook, transcribe-call, audit-call)
✅ Supabase CLI installed

## Step 1: Deploy Edge Functions to Supabase

You need to login and deploy the three Edge Functions that handle automatic Five9 call processing.

### 1a. Login to Supabase CLI

```bash
supabase login
```

This will open your browser to authenticate with Supabase.

### 1b. Link to Your Project

```bash
supabase link --project-ref zkywapiptgpnfkacpyrz
```

When prompted for database password, use: `Br@xd0n2024`

### 1c. Deploy the Three Edge Functions

```bash
# Deploy Five9 webhook receiver
supabase functions deploy five9-webhook

# Deploy transcription function
supabase functions deploy transcribe-call

# Deploy audit function
supabase functions deploy audit-call
```

### 1d. Set Required Secrets

These functions need OpenAI API key for transcription and fallback auditing:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-api-key-here
```

---

## Step 2: Configure Five9 Webhook

Once the Edge Functions are deployed, you'll get a webhook URL that looks like:

```
https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook
```

### 2a. Log into Five9 Admin Panel

1. Go to Five9 admin portal
2. Navigate to **Settings** → **Webhooks** or **Integrations**

### 2b. Create New Webhook

Configure the webhook with:

- **URL:** `https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook`
- **Event:** Call Completed / Call Ended
- **Method:** POST
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer YOUR_SUPABASE_ANON_KEY` (from `.env.local`)

### 2c. Webhook Payload Mapping

Map Five9 fields to the expected payload:

```json
{
  "callId": "{CALL_ID}",
  "agentEmail": "{AGENT_EMAIL}",
  "agentName": "{AGENT_NAME}",
  "customerPhone": "{ANI}",
  "customerName": "{CUSTOMER_NAME}",
  "campaignName": "{CAMPAIGN_NAME}",
  "callType": "{CALL_TYPE}",
  "disposition": "{DISPOSITION}",
  "callStartTime": "{CALL_START_TIME}",
  "callEndTime": "{CALL_END_TIME}",
  "callDuration": "{CALL_DURATION}",
  "recordingUrl": "{RECORDING_URL}",
  "transcriptText": "{TRANSCRIPT_TEXT}"
}
```

**Note:** If Five9 provides pre-transcribed text, include `transcriptText`. Otherwise, the system will transcribe from `recordingUrl`.

---

## Step 3: Test the Integration

### 3a. Make a Test Call

1. Make a test call through Five9
2. Complete the call with a disposition
3. Wait 2-5 minutes for processing

### 3b. Check the Pipeline

Monitor the progress:

```bash
# Check Edge Function logs
supabase functions logs five9-webhook
supabase functions logs transcribe-call
supabase functions logs audit-call
```

### 3c. Verify in Cliopa App

1. Go to **Report Cards** page
2. You should see a new report card appear
3. Scores and feedback should be populated

---

## How It Works

```mermaid
Five9 Call Ends
    ↓
five9-webhook (receives call data)
    ↓
Creates record in 'calls' table
    ↓
If no transcript: transcribe-call (Whisper API)
    ↓
audit-call (LLM analysis)
    ↓
Creates report card in database
    ↓
Real-time update in Cliopa UI
```

**Timeline:**
- Five9 webhook: Instant (< 1 second)
- Transcription: 30-60 seconds (depends on call length)
- AI Audit: 30-90 seconds (LLM processing)
- **Total: 2-5 minutes from call end to report card**

---

## Troubleshooting

### Edge Functions not deploying?
- Make sure you're logged in: `supabase login`
- Make sure you're linked: `supabase link --project-ref zkywapiptgpnfkacpyrz`
- Check you have permission to deploy functions

### Webhook not receiving calls?
- Verify webhook URL is correct in Five9
- Check Five9 webhook logs for errors
- Test webhook manually with curl:

```bash
curl -X POST https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "callId": "test-123",
    "agentEmail": "your-email@example.com",
    "transcriptText": "Test transcript",
    "callStartTime": "2025-11-18T12:00:00Z",
    "callEndTime": "2025-11-18T12:05:00Z"
  }'
```

### Transcription failing?
- Make sure OPENAI_API_KEY is set: `supabase secrets list`
- Check OpenAI API quota and billing
- Verify recording URL is accessible

### Audit not generating?
- Check audit template exists: Run SQL `SELECT * FROM audit_templates WHERE is_default = true`
- Check OpenAI API key is valid
- Monitor Edge Function logs for errors

---

## Next Steps

Once Five9 integration is working:

1. **Add More Agents** - Invite team members via Settings → User Management
2. **Update Audit Criteria** - Currently 12 criteria, you mentioned needing 27 TLC-specific ones
3. **Create Sample Data** - Generate test report cards to see dashboards with data
4. **Enable LM Studio** - For faster, local processing instead of OpenAI

---

## Quick Commands Reference

```bash
# Login to Supabase
supabase login

# Link project
supabase link --project-ref zkywapiptgpnfkacpyrz

# Deploy all functions
supabase functions deploy five9-webhook
supabase functions deploy transcribe-call
supabase functions deploy audit-call

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...

# View logs
supabase functions logs five9-webhook --tail
supabase functions logs transcribe-call --tail
supabase functions logs audit-call --tail

# List deployed functions
supabase functions list

# Test locally (optional)
supabase start
supabase functions serve five9-webhook --env-file .env.local
```

---

**Ready to deploy?** Start with Step 1a (login) and work through each step. The entire deployment takes about 5-10 minutes.
