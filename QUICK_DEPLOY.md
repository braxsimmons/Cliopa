# 🚀 Quick Deploy - Five9 Integration

## Deploy Edge Functions (Run This Now)

Open your terminal and run:

```bash
cd /Users/braxdonsimmons/Desktop/tlc-time-stable
./deploy-five9.sh
```

This script will:
1. ✅ Login to Supabase
2. ✅ Link to your project
3. ✅ Set OpenAI API key
4. ✅ Deploy five9-webhook
5. ✅ Deploy transcribe-call
6. ✅ Deploy audit-call

**Time:** ~2 minutes

---

## Five9 Webhook Configuration

After deployment, configure Five9 to send calls to your webhook.

### Webhook URL
```
https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook
```

### Five9 Admin Portal Steps

1. **Login to Five9 Admin Portal**

2. **Navigate to Webhooks**
   - Settings → Webhooks → Create New Webhook

3. **Webhook Settings**
   - **Name:** Cliopa AI Audit Webhook
   - **URL:** `https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook`
   - **Method:** POST
   - **Event:** Call Completed / Call Ended
   - **Active:** Yes

4. **Headers** (click "Add Header")
   ```
   Content-Type: application/json
   ```

5. **Payload Mapping** (JSON format)
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
     "recordingUrl": "{RECORDING_URL}"
   }
   ```

6. **Save & Enable**

---

## Test the Integration

### Option 1: Make a Real Call

1. Make a test call through Five9
2. Complete the call with a disposition
3. Wait 2-5 minutes
4. Check Cliopa Report Cards page for new audit

### Option 2: Test Webhook Manually

```bash
curl -X POST https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "agentEmail": "braxton.simmons@cliopa.io",
    "agentName": "Braxton Simmons",
    "customerPhone": "+15551234567",
    "campaignName": "Test Campaign",
    "disposition": "Resolved",
    "callStartTime": "2025-11-18T17:00:00Z",
    "callEndTime": "2025-11-18T17:05:00Z",
    "callDuration": "300",
    "recordingUrl": "https://example.com/recording.mp3"
  }'
```

**Note:** Replace `braxton.simmons@cliopa.io` with your actual email in the database.

### Option 3: Monitor Logs

Watch Edge Function logs in real-time:

```bash
supabase functions logs five9-webhook --tail
supabase functions logs transcribe-call --tail
supabase functions logs audit-call --tail
```

---

## How It Works

```
Five9 Call Ends
    ↓
Five9 sends webhook to Supabase
    ↓
five9-webhook receives data
    ↓
Creates record in 'calls' table
    ↓
If no transcript: Triggers transcribe-call
    ↓ (30-60 seconds)
Transcript saved to 'calls' table
    ↓
Triggers audit-call
    ↓ (30-90 seconds)
AI analyzes transcript
    ↓
Creates report card in database
    ↓
Real-time update in Cliopa UI
```

**Total Time:** 2-5 minutes from call end to report card

---

## Troubleshooting

### Deployment fails?
- Make sure you're logged into Supabase: `supabase login`
- Check you have access to project: `supabase projects list`

### No calls coming through?
- Verify webhook is enabled in Five9
- Check webhook URL is exactly: `https://zkywapiptgpnfkacpyrz.supabase.co/functions/v1/five9-webhook`
- Test manually with curl command above
- Monitor logs: `supabase functions logs five9-webhook`

### Transcription fails?
- Check OpenAI API key is valid
- Verify recording URL is accessible
- Check OpenAI API quota/billing

### No report card created?
- Check agent email in Five9 matches email in Cliopa database
- Verify audit template exists: SQL `SELECT * FROM audit_templates WHERE is_default = true`
- Monitor audit-call logs for errors

---

## Your Credentials (Keep Private!)

**Supabase Project:** zkywapiptgpnfkacpyrz

**Supabase URL:** https://zkywapiptgpnfkacpyrz.supabase.co

**Anon Key (Public):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpreXdhcGlwdGdwbmZrYWNweXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMDc0MjcsImV4cCI6MjA3Nzg4MzQyN30.8GoPe9TDWjJWZd0kw543es0872YHIGn2k81CDAqjAu4
```

**Service Role Key (Private - DO NOT SHARE!):**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpreXdhcGlwdGdwbmZrYWNweXJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjMwNzQyNywiZXhwIjoyMDc3ODgzNDI3fQ.aYbxWf695qWI8-Q6c65-Q-6irnx-TsE2fbTXDi1gpDI
```

---

## Next Steps After Deployment

1. ✅ Deploy Edge Functions (`./deploy-five9.sh`)
2. ✅ Configure Five9 webhook (see above)
3. ✅ Test with a real call or curl command
4. ✅ Monitor logs to verify everything works
5. 🎉 Enjoy automatic AI call auditing!

---

**Questions?** Check [FIVE9_DEPLOYMENT_STEPS.md](./FIVE9_DEPLOYMENT_STEPS.md) for detailed troubleshooting.
