/**
 * Processing Queue Component
 *
 * Shows status of automatic call processing and allows manual triggers.
 * Connects to local API server for audio transcription + AI auditing.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callIngestionService } from "@/services/CallIngestionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Activity,
  Database,
  Server,
  Mic,
  Brain,
  Settings,
  Zap,
} from "lucide-react";

interface ProcessingStats {
  pending_count: number;
  queued_count: number;
  processing_count: number;
  completed_today: number;
  failed_today: number;
}

interface SyncStatus {
  last_sync_at: string | null;
  last_sync_status: string | null;
  calls_synced_today: number;
  calls_pending: number;
  total_calls: number;
}

interface LocalServerStatus {
  available: boolean;
  lmStudio: { available: boolean; models?: string[] };
  whisper: { method: string; binary?: string };
  processing: boolean;
}

interface ProcessingResult {
  success: boolean;
  processed: number;
  successful: number;
  failed: number;
  results?: Array<{
    callId: string;
    success: boolean;
    error?: string;
    score?: number;
  }>;
  error?: string;
  message?: string;
}

const LOCAL_API_URL = "http://localhost:3001";

export default function ProcessingQueue() {
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [localStatus, setLocalStatus] = useState<LocalServerStatus | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cloudProcessing, setCloudProcessing] = useState(false);
  const [cloudProgress, setCloudProgress] = useState({ current: 0, total: 0 });
  const [lastResult, setLastResult] = useState<ProcessingResult | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadStats();
    loadSyncStatus();
    checkLocalServer();
    loadPendingCount();

    // Auto-refresh every 30 seconds
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadStats();
        loadSyncStatus();
        checkLocalServer();
        loadPendingCount();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Poll for processing status when processing
  useEffect(() => {
    if (processing && !pollingInterval) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${LOCAL_API_URL}/api/status`);
          if (response.ok) {
            const status = await response.json();
            if (!status.isProcessing) {
              // Processing finished
              setProcessing(false);
              setLastResult({
                success: true,
                processed: status.processed,
                successful: status.successful,
                failed: status.failed,
              });
              loadStats();
              loadPendingCount();
              if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
              }
            }
          }
        } catch (e) {
          // Server might not be available
        }
      }, 3000);
      setPollingInterval(interval);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [processing]);

  async function loadStats() {
    try {
      const { data, error } = await supabase.rpc("get_processing_stats");

      if (error) {
        // Function might not exist, load from calls directly
        const { data: calls } = await supabase
          .from("calls")
          .select("status")
          .in("status", ["pending", "transcribed", "audited", "failed"]);

        if (calls) {
          const pending = calls.filter(c => c.status === "pending").length;
          const audited = calls.filter(c => c.status === "audited").length;
          const failed = calls.filter(c => c.status === "failed").length;
          setStats({
            pending_count: pending,
            queued_count: 0,
            processing_count: 0,
            completed_today: audited,
            failed_today: failed,
          });
        }
        return;
      }

      const statsData = Array.isArray(data) ? data[0] : data;
      setStats(statsData);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSyncStatus() {
    try {
      const { data, error } = await supabase.rpc("get_sync_status");

      if (error) {
        // Function might not exist
        return;
      }

      const statusData = Array.isArray(data) ? data[0] : data;
      setSyncStatus(statusData);
    } catch (error) {
      console.error("Error loading sync status:", error);
    }
  }

  async function checkLocalServer() {
    try {
      const response = await fetch(`${LOCAL_API_URL}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        setLocalStatus({
          available: true,
          lmStudio: data.lmStudio,
          whisper: data.whisper,
          processing: data.processing,
        });
      } else {
        setLocalStatus({ available: false, lmStudio: { available: false }, whisper: { method: "none" }, processing: false });
      }
    } catch {
      setLocalStatus({ available: false, lmStudio: { available: false }, whisper: { method: "none" }, processing: false });
    }
  }

  async function loadPendingCount() {
    try {
      const { count, error } = await supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .not("recording_url", "is", null)
        .gte("call_duration_seconds", 30)
        .lte("call_duration_seconds", 600);

      if (!error) {
        setPendingCount(count || 0);
      }
    } catch (error) {
      console.error("Error loading pending count:", error);
    }
  }

  function formatTimeAgo(dateStr: string | null) {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  }

  async function triggerLocalProcessing() {
    if (!localStatus?.available) {
      setLastResult({
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: "Local API server is not running. Start it with: cd sync-service && node api-server.js",
      });
      return;
    }

    if (!localStatus.lmStudio.available) {
      setLastResult({
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: "LM Studio is not available. Please start LM Studio and load a model.",
      });
      return;
    }

    if (localStatus.whisper.method === "none") {
      setLastResult({
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: "Whisper is not installed. Install with: pip install openai-whisper",
      });
      return;
    }

    setProcessing(true);
    setLastResult(null);

    try {
      const response = await fetch(`${LOCAL_API_URL}/api/audit/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Processing failed");
      }

      // Processing started - poll for updates
      setLastResult({
        success: true,
        processed: 0,
        successful: 0,
        failed: 0,
        message: data.message,
      });
    } catch (error: any) {
      console.error("Processing error:", error);
      setProcessing(false);
      setLastResult({
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: error.message || "Failed to process queue",
      });
    }
  }

  /**
   * Process pending calls using cloud AI (Gemini) directly
   * This works for calls that already have transcripts
   */
  async function processWithCloudAI() {
    setCloudProcessing(true);
    setCloudProgress({ current: 0, total: 0 });
    setLastResult(null);

    try {
      const result = await callIngestionService.processPendingCalls({
        batchSize,
        delayBetweenCalls: 1500, // 1.5 seconds between calls for Gemini rate limits
        onProgress: (current, total, _callId, _success) => {
          setCloudProgress({ current, total });
        },
      });

      setLastResult({
        success: result.failed === 0,
        processed: result.total,
        successful: result.successful,
        failed: result.failed,
        message: `Processed ${result.total} calls: ${result.successful} successful, ${result.failed} failed`,
        results: result.errors.map(e => ({
          callId: e.callId,
          success: false,
          error: e.error,
        })),
      });

      // Refresh stats
      loadStats();
      loadPendingCount();
    } catch (error: any) {
      console.error("Cloud processing error:", error);
      setLastResult({
        success: false,
        processed: 0,
        successful: 0,
        failed: 0,
        error: error.message || "Failed to process with cloud AI",
      });
    } finally {
      setCloudProcessing(false);
      setCloudProgress({ current: 0, total: 0 });
    }
  }

  const isReady = localStatus?.available && localStatus?.lmStudio?.available && localStatus?.whisper?.method !== "none";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Call Processing Queue</h2>
          <p className="text-sm text-muted-foreground">
            Transcribe and audit calls using local AI (Whisper + LM Studio)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadStats();
              loadSyncStatus();
              checkLocalServer();
              loadPendingCount();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Local Server Status */}
      <Card className={`${isReady ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" : "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-full ${isReady ? "bg-green-100" : "bg-orange-100"} flex items-center justify-center`}>
                <Server className={`h-6 w-6 ${isReady ? "text-green-600" : "text-orange-600"}`} />
              </div>
              <div>
                <h3 className={`font-semibold ${isReady ? "text-green-900" : "text-orange-900"}`}>
                  Local Processing Server
                </h3>
                <p className={`text-sm ${isReady ? "text-green-700" : "text-orange-700"}`}>
                  {localStatus?.available ? "Connected" : "Not running - start with: node sync-service/api-server.js"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* LM Studio Status */}
              <div className="flex items-center gap-2">
                <Brain className={`h-5 w-5 ${localStatus?.lmStudio?.available ? "text-green-600" : "text-red-500"}`} />
                <div className="text-sm">
                  <p className="font-medium">LM Studio</p>
                  <p className={localStatus?.lmStudio?.available ? "text-green-600" : "text-red-500"}>
                    {localStatus?.lmStudio?.available ? "Ready" : "Not available"}
                  </p>
                </div>
              </div>

              {/* Whisper Status */}
              <div className="flex items-center gap-2">
                <Mic className={`h-5 w-5 ${localStatus?.whisper?.method !== "none" ? "text-green-600" : "text-red-500"}`} />
                <div className="text-sm">
                  <p className="font-medium">Whisper</p>
                  <p className={localStatus?.whisper?.method !== "none" ? "text-green-600" : "text-red-500"}>
                    {localStatus?.whisper?.method !== "none" ? localStatus?.whisper?.binary || "Ready" : "Not installed"}
                  </p>
                </div>
              </div>

              {/* Pending Count */}
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
                <p className="text-sm text-blue-700">pending calls</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Process Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Process Calls
          </CardTitle>
          <CardDescription>
            Run AI audit on pending calls with audio recordings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="w-32">
              <Label htmlFor="batchSize">Batch Size</Label>
              <Input
                id="batchSize"
                type="number"
                min={1}
                max={50}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value) || 10)}
                className="mt-1"
              />
            </div>
            <Button
              onClick={triggerLocalProcessing}
              disabled={processing || pendingCount === 0 || !isReady}
              size="lg"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Process {Math.min(batchSize, pendingCount)} Calls
                </>
              )}
            </Button>
          </div>

          {!isReady && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 mb-2">Local Processing Setup (for audio files)</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                {!localStatus?.available && (
                  <li>1. Start the local API server: <code className="bg-amber-100 px-1 rounded">cd sync-service && node api-server.js</code></li>
                )}
                {localStatus?.available && !localStatus?.lmStudio?.available && (
                  <li>2. Start LM Studio and load a model (port 1234)</li>
                )}
                {localStatus?.available && localStatus?.whisper?.method === "none" && (
                  <li>3. Install Whisper: <code className="bg-amber-100 px-1 rounded">pip install openai-whisper</code></li>
                )}
              </ul>
            </div>
          )}

          {/* Cloud AI Processing - For calls with transcripts */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Cloud AI Processing (Gemini)
            </h4>
            <p className="text-sm text-muted-foreground mb-3">
              Process calls that already have transcripts using Google Gemini AI. No local setup required.
            </p>
            <div className="flex items-center gap-4">
              <Button
                onClick={processWithCloudAI}
                disabled={cloudProcessing || processing || pendingCount === 0}
                variant="secondary"
                size="lg"
              >
                {cloudProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing {cloudProgress.current}/{cloudProgress.total}...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Process with Gemini AI
                  </>
                )}
              </Button>
              {cloudProcessing && cloudProgress.total > 0 && (
                <div className="flex-1">
                  <Progress value={(cloudProgress.current / cloudProgress.total) * 100} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {cloudProgress.current} of {cloudProgress.total} calls processed
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Result */}
      {lastResult && (
        <Card className={lastResult.success ? "border-green-500" : "border-red-500"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              {lastResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Processing Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult.error ? (
              <p className="text-red-600">{lastResult.error}</p>
            ) : lastResult.message ? (
              <p className="text-green-600">{lastResult.message}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <Badge variant="outline">Processed: {lastResult.processed}</Badge>
                  <Badge variant="default" className="bg-green-600">Successful: {lastResult.successful}</Badge>
                  {lastResult.failed > 0 && (
                    <Badge variant="destructive">Failed: {lastResult.failed}</Badge>
                  )}
                </div>

                {lastResult.results && lastResult.results.some(r => !r.success) && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Errors:</p>
                    <div className="text-sm text-red-600 space-y-1">
                      {lastResult.results
                        .filter(r => !r.success)
                        .map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>Call {r.callId}: {r.error}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {lastResult.results && lastResult.results.some(r => r.success) && (
                  <div className="mt-2">
                    <p className="text-sm font-medium mb-1">Completed:</p>
                    <div className="text-sm text-green-600 space-y-1">
                      {lastResult.results
                        .filter(r => r.success)
                        .map((r, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>Call {r.callId}: Score {r.score}/100</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats?.pending_count || pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">{stats?.completed_today || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Today</p>
                <p className="text-2xl font-bold text-red-600">{stats?.failed_today || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Processing</p>
                <p className="text-2xl font-bold text-yellow-600">{localStatus?.processing ? "Yes" : "No"}</p>
              </div>
              <Loader2 className={`h-8 w-8 text-yellow-600 ${localStatus?.processing ? "animate-spin" : ""}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Local Audio Processing Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="font-bold text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-medium">Download Audio</h4>
                <p className="text-sm text-muted-foreground">
                  Audio files downloaded from NAS
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="font-bold text-blue-600">2</span>
              </div>
              <div>
                <h4 className="font-medium">Transcribe (Whisper)</h4>
                <p className="text-sm text-muted-foreground">
                  Local Whisper converts audio to text
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="font-bold text-blue-600">3</span>
              </div>
              <div>
                <h4 className="font-medium">AI Audit (LM Studio)</h4>
                <p className="text-sm text-muted-foreground">
                  LLM analyzes transcript for quality
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="font-bold text-blue-600">4</span>
              </div>
              <div>
                <h4 className="font-medium">Report Card</h4>
                <p className="text-sm text-muted-foreground">
                  Scores saved to agent profile
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Quick Start</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>1. Start LM Studio and load a model (e.g., Qwen 2.5 7B Instruct)</p>
              <p>2. Make sure Whisper is installed: <code className="bg-muted px-1 rounded">pip install openai-whisper</code></p>
              <p>3. Start the API server: <code className="bg-muted px-1 rounded">cd sync-service && node api-server.js</code></p>
              <p>4. Click "Process Calls" above to start auditing!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
