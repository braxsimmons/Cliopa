# Cliopa Call Sync Service

Syncs call recordings from your SQL Server (Five9 data) to Cliopa/Supabase for AI auditing.

## How It Works

```
SQL Server (Five9 data)
        ↓
    Sync Service (runs every 15 min)
        ↓
    Fetches transcripts from NAS
        ↓
    Inserts into Supabase 'calls' table
        ↓
    Auto-queues for AI processing
        ↓
    Report cards created
```

## Setup

### 1. Install Dependencies

```bash
cd sync-service
npm install
```

### 2. Configure Environment

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# SQL Server Configuration
MSSQL_SERVER=sql03.ad.yattaops.com
MSSQL_DATABASE=Yatta
MSSQL_USERNAME=bsimmons
MSSQL_PASSWORD=your_password_here

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# Sync Configuration
SYNC_INTERVAL_MINUTES=15
SYNC_BATCH_SIZE=50
SYNC_LOOKBACK_HOURS=24
```

### 3. Test Connections

```bash
npm run test-connection
```

This will test:
- SQL Server connection
- Supabase connection
- Transcript URL accessibility

### 4. Run the Sync

**One-time sync:**
```bash
npm run sync:once
```

**Continuous sync (every N minutes):**
```bash
npm run sync
```

## Running as a Service

### Option 1: PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the sync service
pm2 start sync.js --name "cliopa-sync"

# Save the process list
pm2 save

# Setup auto-start on boot
pm2 startup
```

### Option 2: Systemd (Linux)

Create `/etc/systemd/system/cliopa-sync.service`:

```ini
[Unit]
Description=Cliopa Call Sync Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cliopa/sync-service
ExecStart=/usr/bin/node sync.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable cliopa-sync
sudo systemctl start cliopa-sync
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily (or at startup)
4. Action: Start a program
5. Program: `node`
6. Arguments: `C:\path\to\sync-service\sync.js`
7. Start in: `C:\path\to\sync-service`

## What Gets Synced

From `fivenine.call_recording_logs`:

| SQL Server Field | Cliopa Field |
|-----------------|--------------|
| call_id / recording_id | call_id |
| call_timestamp | call_start_time |
| length_seconds | call_duration_seconds |
| call_type | call_type |
| campaign | campaign_name |
| agent_email | → matched to user_id |
| number1 | customer_phone |
| first_name + last_name | customer_name |
| disposition | disposition |
| recording_link | recording_url |
| transcript_link | transcript_url + transcript_text |

## Agent Matching

Agents are matched by email address:
1. Exact match on `profiles.email`
2. Partial match on email username (fallback)

**Make sure your agents in Cliopa have the same email addresses as in Five9!**

## Troubleshooting

### "Agent not found" errors
- Check that the agent's email in Five9 matches their email in Cliopa
- Emails are case-insensitive but must otherwise match

### SQL Server connection fails
- Check firewall rules allow connection from sync server
- Verify credentials in `.env`
- Try with `trustServerCertificate: true` in config

### Transcripts not fetching
- Verify `nas01.tlcops.com` is accessible from sync server
- Check transcript URL format matches your file structure

### Calls not being audited
- Verify AI settings are enabled in Cliopa Company Settings
- Check the processing queue in Cliopa UI
- Manually trigger processing if needed
