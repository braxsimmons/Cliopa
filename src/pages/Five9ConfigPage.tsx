import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Webhook, CheckCircle2, XCircle, RefreshCw, Copy, Settings } from 'lucide-react';

interface QueuedCall {
  id: string;
  call_id?: string;
  campaign_name?: string;
  call_start_time?: string;
  status: 'pending' | 'transcribed' | 'audited' | 'failed';
  user_id: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

export const Five9ConfigPage: React.FC = () => {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [queuedCalls, setQueuedCalls] = useState<QueuedCall[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [supabaseProjectUrl, setSupabaseProjectUrl] = useState<string>('');

  useEffect(() => {
    loadConfig();
    loadQueuedCalls();
  }, []);

  const loadConfig = async () => {
    // Get Supabase project URL from environment
    const projectUrl = import.meta.env.VITE_SUPABASE_URL || '';
    setSupabaseProjectUrl(projectUrl);

    // Construct webhook URL
    if (projectUrl) {
      const url = `${projectUrl}/functions/v1/five9-webhook`;
      setWebhookUrl(url);
    }
  };

  const loadQueuedCalls = async () => {
    setLoadingQueue(true);
    try {
      const { data, error } = await supabase
        .from('calls')
        .select(`
          id,
          call_id,
          campaign_name,
          call_start_time,
          status,
          user_id,
          profiles:user_id (first_name, last_name, email)
        `)
        .in('status', ['pending', 'transcribed'])
        .order('call_start_time', { ascending: false })
        .limit(10);

      if (error) throw error;
      setQueuedCalls(data || []);
    } catch (error: any) {
      console.error('Error loading queued calls:', error);
      toast({
        title: 'Error',
        description: 'Failed to load queued calls',
        variant: 'destructive',
      });
    } finally {
      setLoadingQueue(false);
    }
  };

  const copyWebhookUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: 'Copied!',
        description: 'Webhook URL copied to clipboard',
      });
    }
  };

  const testWebhookConnection = async () => {
    setTestingWebhook(true);
    try {
      // Send a test payload to the webhook
      const testPayload = {
        callId: 'TEST-' + Date.now(),
        agentEmail: 'test@example.com',
        campaignName: 'TEST_CAMPAIGN',
        callType: 'INBOUND',
        callStartTime: new Date().toISOString(),
        callEndTime: new Date().toISOString(),
        callDuration: 120,
        transcriptText: 'This is a test transcript for webhook validation.',
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        toast({
          title: 'Webhook Test Successful',
          description: 'Five9 webhook is properly configured and responding',
        });
      } else {
        const errorText = await response.text();
        throw new Error(`Webhook returned ${response.status}: ${errorText}`);
      }
    } catch (error: any) {
      console.error('Webhook test error:', error);
      toast({
        title: 'Webhook Test Failed',
        description: error.message || 'Could not connect to webhook endpoint',
        variant: 'destructive',
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  const retryCall = async (callId: string) => {
    try {
      // Get the call record
      const { data: call, error: fetchError } = await supabase
        .from('calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (fetchError || !call) throw new Error('Call not found');

      // Trigger appropriate function based on status
      if (call.status === 'pending' && call.recording_url) {
        // Trigger transcription
        const { error: invokeError } = await supabase.functions.invoke('transcribe-call', {
          body: { callId: call.id, recordingUrl: call.recording_url },
        });
        if (invokeError) throw invokeError;

        toast({
          title: 'Transcription Started',
          description: 'Call transcription has been queued',
        });
      } else if (call.status === 'transcribed' && call.transcript_text) {
        // Trigger audit
        const { error: invokeError } = await supabase.functions.invoke('audit-call', {
          body: { callId: call.id },
        });
        if (invokeError) throw invokeError;

        toast({
          title: 'Audit Started',
          description: 'Call audit has been queued',
        });
      }

      // Refresh queue
      setTimeout(() => loadQueuedCalls(), 2000);
    } catch (error: any) {
      console.error('Retry error:', error);
      toast({
        title: 'Retry Failed',
        description: error.message || 'Could not retry call processing',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      transcribed: 'bg-blue-100 text-blue-800 border-blue-300',
      audited: 'bg-green-100 text-green-800 border-green-300',
      failed: 'bg-red-100 text-red-800 border-red-300',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || ''}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Phone className="w-8 h-8 text-[var(--color-accent)]" />
          <h1 className="text-3xl font-bold text-[var(--color-text)]">
            Five9 Integration
          </h1>
        </div>
        <p className="text-[var(--color-subtext)]">
          Configure Five9 webhook to enable automatic call processing and real-time report cards
        </p>
      </div>

      {/* Webhook Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Webhook Configuration
          </CardTitle>
          <CardDescription>
            Use this URL in your Five9 admin panel to send call completion events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhookUrl ? (
            <>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-[var(--color-surface)] border rounded-lg font-mono text-sm break-all">
                  {webhookUrl}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyWebhookUrl}
                  title="Copy webhook URL"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={testWebhookConnection}
                  disabled={testingWebhook}
                  className="flex items-center gap-2"
                >
                  {testingWebhook ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Test Webhook Connection
                </Button>

                <Button
                  variant="outline"
                  onClick={loadQueuedCalls}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Queue
                </Button>
              </div>
            </>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Supabase project URL not configured. Please set VITE_SUPABASE_URL in your environment.
              </p>
            </div>
          )}

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2 text-sm">Five9 Setup Instructions:</h4>
            <ol className="text-sm text-[var(--color-subtext)] space-y-1 list-decimal list-inside">
              <li>Log in to Five9 Admin Panel</li>
              <li>Navigate to Settings → Webhooks</li>
              <li>Create a new webhook for "Call Completed" events</li>
              <li>Paste the URL above as the endpoint</li>
              <li>Set method to POST and content type to application/json</li>
              <li>Configure payload to include: callId, agentEmail, recordingUrl, callStartTime, callEndTime</li>
              <li>Test the webhook using the button above</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Processing Architecture */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Processing Pipeline
          </CardTitle>
          <CardDescription>
            How calls flow through the system automatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Webhook Reception</h4>
                <p className="text-xs text-[var(--color-subtext)]">
                  Five9 sends call completion event to Supabase Edge Function
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Transcription</h4>
                <p className="text-xs text-[var(--color-subtext)]">
                  Audio recording converted to text via OpenAI Whisper API (~30-60 seconds)
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">AI Audit</h4>
                <p className="text-xs text-[var(--color-subtext)]">
                  Transcript analyzed against audit criteria via LM Studio or OpenAI (~2-5 seconds)
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Report Card Created</h4>
                <p className="text-xs text-[var(--color-subtext)]">
                  Dimensional scores calculated and saved, visible in dashboard immediately
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                ⚡ Total Processing Time: 2-5 minutes from call end to report card
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Processing Queue
          </CardTitle>
          <CardDescription>
            Calls currently being processed or awaiting processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingQueue ? (
            <div className="text-center py-8 text-[var(--color-subtext)]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading queue...
            </div>
          ) : queuedCalls.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-subtext)]">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
              <p>No calls currently in queue</p>
              <p className="text-xs mt-1">All calls have been processed</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 text-sm font-semibold">Call ID</th>
                    <th className="pb-3 text-sm font-semibold">Agent</th>
                    <th className="pb-3 text-sm font-semibold">Campaign</th>
                    <th className="pb-3 text-sm font-semibold">Start Time</th>
                    <th className="pb-3 text-sm font-semibold">Status</th>
                    <th className="pb-3 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queuedCalls.map((call) => (
                    <tr key={call.id} className="border-b last:border-0">
                      <td className="py-3 text-sm font-mono">{call.call_id || call.id.slice(0, 8)}</td>
                      <td className="py-3 text-sm">
                        {call.profiles
                          ? `${call.profiles.first_name} ${call.profiles.last_name}`
                          : 'Unknown'}
                      </td>
                      <td className="py-3 text-sm">{call.campaign_name || '—'}</td>
                      <td className="py-3 text-sm">
                        {call.call_start_time
                          ? new Date(call.call_start_time).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3">{getStatusBadge(call.status)}</td>
                      <td className="py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryCall(call.id)}
                          className="text-xs"
                        >
                          Retry
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
