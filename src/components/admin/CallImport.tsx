/**
 * Call Import Component
 *
 * Allows importing calls directly without Five9.
 * Supports single transcript upload and bulk CSV import.
 */

import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { callIngestionService, BulkImportResult } from "@/services/CallIngestionService";
import ProcessingQueue from "./ProcessingQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  Activity,
} from "lucide-react";

interface Agent {
  id: string;
  full_name: string;
  email: string;
}

export default function CallImport() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single import state
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [callType, setCallType] = useState<string>("inbound");
  const [campaignName, setCampaignName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [disposition, setDisposition] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  // Bulk import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResult, setBulkResult] = useState<BulkImportResult | null>(null);

  // Agents list
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Load agents on mount
  useState(() => {
    loadAgents();
  });

  async function loadAgents() {
    setLoadingAgents(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("role", ["agent", "manager", "admin"])
      .order("full_name");

    setAgents(data || []);
    setLoadingAgents(false);
  }

  // Handle single transcript import
  async function handleSingleImport() {
    if (!selectedAgent || !transcript.trim()) {
      setImportResult({ success: false, message: "Please select an agent and enter a transcript" });
      return;
    }

    setImporting(true);
    setImportResult(null);

    const result = await callIngestionService.importCall({
      userId: selectedAgent,
      transcriptText: transcript,
      callType: callType as 'inbound' | 'outbound' | 'internal',
      campaignName: campaignName || undefined,
      customerPhone: customerPhone || undefined,
      customerName: customerName || undefined,
      disposition: disposition || undefined,
    });

    setImporting(false);

    if (result.success) {
      setImportResult({ success: true, message: `Call imported successfully! ID: ${result.callId}` });
      // Clear form
      setTranscript("");
      setCampaignName("");
      setCustomerPhone("");
      setCustomerName("");
      setDisposition("");
    } else {
      setImportResult({ success: false, message: result.error || "Import failed" });
    }
  }

  // Handle CSV file selection
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setBulkResult(null);

    // Read and preview
    const content = await file.text();
    const rows = callIngestionService.parseCSV(content);
    setCsvPreview(rows.slice(0, 5)); // Show first 5 rows as preview
  }

  // Handle bulk import
  async function handleBulkImport() {
    if (!csvFile) return;

    setBulkImporting(true);
    setBulkProgress(0);
    setBulkResult(null);

    const content = await csvFile.text();
    const rows = callIngestionService.parseCSV(content);

    // Import with progress tracking
    const results: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Look up user
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", row.agent_email)
        .single();

      if (profile) {
        const result = await callIngestionService.importCall({
          userId: profile.id,
          transcriptText: row.transcript,
          callStartTime: row.call_date,
          callDurationSeconds: row.call_duration_seconds,
          callType: (row.call_type?.toLowerCase() as any) || 'inbound',
          campaignName: row.campaign,
          customerPhone: row.customer_phone,
          customerName: row.customer_name,
          disposition: row.disposition,
        });
        results.push(result);
      } else {
        results.push({ success: false, error: `Agent not found: ${row.agent_email}` });
      }

      setBulkProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setBulkImporting(false);
    setBulkResult({
      total: rows.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  }

  // Download CSV template
  function downloadTemplate() {
    const template = `agent_email,transcript,call_date,call_duration_seconds,call_type,campaign,customer_phone,customer_name,disposition
agent@example.com,"Agent: Thank you for calling. How can I help you today?
Customer: I have a question about my account.
Agent: I'd be happy to help. Can you verify your account number?",2024-01-15T10:30:00Z,180,inbound,Collections,555-123-4567,John Doe,Resolved`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'call_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Calls</h1>
        <p className="text-muted-foreground">
          Import call transcripts for AI analysis and auditing
        </p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue" className="gap-2">
            <Activity className="h-4 w-4" />
            Auto Processing
          </TabsTrigger>
          <TabsTrigger value="single" className="gap-2">
            <FileText className="h-4 w-4" />
            Single Import
          </TabsTrigger>
          <TabsTrigger value="bulk" className="gap-2">
            <Users className="h-4 w-4" />
            Bulk Import (CSV)
          </TabsTrigger>
        </TabsList>

        {/* Auto Processing Queue Tab */}
        <TabsContent value="queue">
          <ProcessingQueue />
        </TabsContent>

        {/* Single Import Tab */}
        <TabsContent value="single">
          <Card>
            <CardHeader>
              <CardTitle>Import Single Call</CardTitle>
              <CardDescription>
                Paste a call transcript to import and analyze
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agent *</Label>
                  <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.full_name} ({agent.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Call Type</Label>
                  <Select value={callType} onValueChange={setCallType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign</Label>
                  <Input
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    placeholder="e.g., Collections, Support"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Disposition</Label>
                  <Input
                    value={disposition}
                    onChange={e => setDisposition(e.target.value)}
                    placeholder="e.g., Resolved, Callback"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Phone</Label>
                  <Input
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="555-123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transcript *</Label>
                <Textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="Paste the call transcript here...

Example format:
Agent: Thank you for calling. How can I help you today?
Customer: I have a question about my bill.
Agent: I'd be happy to help you with that..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              {importResult && (
                <div className={`p-4 rounded-lg flex items-center gap-2 ${
                  importResult.success
                    ? "bg-green-500/10 text-green-600"
                    : "bg-red-500/10 text-red-600"
                }`}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  {importResult.message}
                </div>
              )}

              <Button
                onClick={handleSingleImport}
                disabled={importing || !selectedAgent || !transcript.trim()}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing & Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Call
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Import Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Import from CSV</CardTitle>
              <CardDescription>
                Import multiple calls at once from a CSV file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>

                <div className="text-sm text-muted-foreground">
                  Download the CSV template to see the required format
                </div>
              </div>

              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {csvFile ? (
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-primary" />
                    <p className="font-medium">{csvFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {csvPreview.length > 0
                        ? `${csvPreview.length}+ rows detected`
                        : "Parsing..."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvPreview([]);
                        setBulkResult(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="font-medium">Drop CSV file here or click to upload</p>
                    <p className="text-sm text-muted-foreground">
                      Required columns: agent_email, transcript
                    </p>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      Select File
                    </Button>
                  </div>
                )}
              </div>

              {/* Preview Table */}
              {csvPreview.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 text-sm font-medium">
                    Preview (first 5 rows)
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent Email</TableHead>
                        <TableHead>Transcript</TableHead>
                        <TableHead>Call Type</TableHead>
                        <TableHead>Campaign</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">
                            {row.agent_email}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {row.transcript?.substring(0, 100)}...
                          </TableCell>
                          <TableCell>{row.call_type || 'inbound'}</TableCell>
                          <TableCell>{row.campaign || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Progress */}
              {bulkImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Importing calls...</span>
                    <span>{bulkProgress}%</span>
                  </div>
                  <Progress value={bulkProgress} />
                </div>
              )}

              {/* Results */}
              {bulkResult && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Import Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{bulkResult.total}</div>
                        <div className="text-sm text-muted-foreground">Total</div>
                      </div>
                      <div className="text-center p-4 bg-green-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {bulkResult.successful}
                        </div>
                        <div className="text-sm text-muted-foreground">Successful</div>
                      </div>
                      <div className="text-center p-4 bg-red-500/10 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">
                          {bulkResult.failed}
                        </div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                    </div>

                    {bulkResult.failed > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Errors:</h4>
                        <div className="max-h-[200px] overflow-auto space-y-1">
                          {bulkResult.results
                            .filter(r => !r.success)
                            .map((r, i) => (
                              <div
                                key={i}
                                className="text-sm text-red-600 flex items-center gap-2"
                              >
                                <XCircle className="h-4 w-4 shrink-0" />
                                {r.error}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || !csvFile || csvPreview.length === 0}
                className="w-full"
              >
                {bulkImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import All Calls
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-bold text-primary">1</span>
              </div>
              <div>
                <h4 className="font-medium">Import</h4>
                <p className="text-sm text-muted-foreground">
                  Upload call transcripts individually or in bulk via CSV
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-bold text-primary">2</span>
              </div>
              <div>
                <h4 className="font-medium">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Calls are automatically audited and analyzed for compliance, tone, and quality
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="font-bold text-primary">3</span>
              </div>
              <div>
                <h4 className="font-medium">Review</h4>
                <p className="text-sm text-muted-foreground">
                  View report cards, scores, and coaching recommendations
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
