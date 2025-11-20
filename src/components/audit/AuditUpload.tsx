import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuditProcessor } from "@/hooks/useAuditProcessor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Cpu, Cloud, CheckCircle2, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ProfileSelectAllColumns } from "@/services/ProfilesService";

export const AuditUpload: React.FC = () => {
  const { user } = useAuth();
  const { processAudit, processing, result, useLocalLLM, setUseLocalLLM, lmStudioAvailable, checkLMStudioAvailability } = useAuditProcessor();

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [sourceFile, setSourceFile] = useState<string>("manual_upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Load employees on mount
  React.useEffect(() => {
    const loadEmployees = async () => {
      setLoadingEmployees(true);
      const { profiles, error } = await ProfileSelectAllColumns();
      if (!error && profiles) {
        // Include all users (admins can audit themselves or others)
        setEmployees(profiles);
      }
      setLoadingEmployees(false);
    };
    loadEmployees();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setSourceFile(file.name);

    // Read file contents
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setTranscriptText(text);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      alert("Please select an agent");
      return;
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      alert("Please provide transcript text");
      return;
    }

    await processAudit(transcriptText, selectedUserId, sourceFile);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getResultBadge = (result: string) => {
    if (result === "PASS") return "bg-green-100 text-green-800 px-2 py-1 rounded";
    if (result === "PARTIAL") return "bg-yellow-100 text-yellow-800 px-2 py-1 rounded";
    return "bg-red-100 text-red-800 px-2 py-1 rounded";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            AI Call Audit Tool
          </CardTitle>
          <CardDescription>
            Upload a call transcript or paste text to generate an AI-powered quality audit
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* AI Provider Status */}
          <div className="mb-6 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                <span className="font-semibold">AI Processing</span>
              </div>
              <button
                type="button"
                onClick={checkLMStudioAvailability}
                className="text-sm text-[var(--color-accent)] hover:underline"
              >
                Refresh Status
              </button>
            </div>

            <div className="space-y-3">
              {/* LM Studio Status */}
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span className="text-sm font-medium">LM Studio (Local)</span>
                  {lmStudioAvailable === true && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {lmStudioAvailable === false && <XCircle className="w-4 h-4 text-red-600" />}
                  {lmStudioAvailable === null && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-subtext)]">
                    {lmStudioAvailable ? "Connected" : "Not Available"}
                  </span>
                  <Switch
                    checked={useLocalLLM}
                    onCheckedChange={setUseLocalLLM}
                    disabled={lmStudioAvailable === false}
                  />
                </div>
              </div>

              {/* OpenAI Status */}
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg)] rounded">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  <span className="text-sm font-medium">OpenAI (Cloud)</span>
                </div>
                <span className="text-xs text-[var(--color-subtext)]">
                  {useLocalLLM && lmStudioAvailable ? "Fallback" : "Active"}
                </span>
              </div>
            </div>

            {/* Info Message */}
            {lmStudioAvailable && (
              <p className="text-xs text-green-600 mt-3">
                ✓ Real-time local processing enabled - Fast, private, no API costs
              </p>
            )}
            {!lmStudioAvailable && (
              <p className="text-xs text-[var(--color-subtext)] mt-3">
                💡 Start LM Studio on port 1234 for local processing. Currently using OpenAI fallback.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="agent">Select Agent *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingEmployees}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmployees ? "Loading agents..." : "Select an agent"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Upload Transcript File</Label>
              <Input
                id="file"
                type="file"
                accept=".txt,.md,.json"
                onChange={handleFileUpload}
                disabled={processing}
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: .txt, .md, .json
              </p>
            </div>

            {/* Or Text Input */}
            <div className="space-y-2">
              <Label htmlFor="transcript">Or Paste Transcript Text *</Label>
              <Textarea
                id="transcript"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste the call transcript here..."
                rows={12}
                disabled={processing}
                className="font-mono text-sm"
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={processing || !selectedUserId || !transcriptText} className="w-full">
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Audit...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate AI Audit
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Results</CardTitle>
            <CardDescription>AI-generated quality assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-6 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
              <h3 className="text-lg font-semibold mb-2">Overall Score</h3>
              <p className={`text-5xl font-bold ${getScoreColor(result.overall_score)}`}>
                {result.overall_score}/100
              </p>
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Summary</h3>
              <p className="text-[var(--color-subtext)]">{result.summary}</p>
            </div>

            {/* Dimensional Scores */}
            {(result.communication_score || result.compliance_score || result.accuracy_score) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Dimensional Scores</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {result.communication_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Communication</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.communication_score)}`}>
                        {result.communication_score}
                      </p>
                    </div>
                  )}
                  {result.compliance_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Compliance</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.compliance_score)}`}>
                        {result.compliance_score}
                      </p>
                    </div>
                  )}
                  {result.accuracy_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Accuracy</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.accuracy_score)}`}>
                        {result.accuracy_score}
                      </p>
                    </div>
                  )}
                  {result.tone_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Tone</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.tone_score)}`}>
                        {result.tone_score}
                      </p>
                    </div>
                  )}
                  {result.empathy_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Empathy</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.empathy_score)}`}>
                        {result.empathy_score}
                      </p>
                    </div>
                  )}
                  {result.resolution_score && (
                    <div className="p-4 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                      <p className="text-sm text-[var(--color-subtext)] mb-1">Resolution</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.resolution_score)}`}>
                        {result.resolution_score}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Criteria Results Table */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Detailed Criteria Assessment</h3>
              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[var(--color-surface)]">
                    <tr>
                      <th className="text-left p-3 font-semibold">Criterion</th>
                      <th className="text-left p-3 font-semibold">Result</th>
                      <th className="text-left p-3 font-semibold">Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.criteria.map((criterion, index) => (
                      <tr
                        key={criterion.id}
                        className={index % 2 === 0 ? "bg-[var(--color-bg)]" : "bg-[var(--color-surface)]"}
                      >
                        <td className="p-3 font-medium">{criterion.id}</td>
                        <td className="p-3">
                          <span className={getResultBadge(criterion.result)}>{criterion.result}</span>
                        </td>
                        <td className="p-3 text-sm text-[var(--color-subtext)]">{criterion.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendations */}
            {result.recommendations && result.recommendations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
                <ul className="list-disc list-inside space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="text-[var(--color-subtext)]">
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
