import React, { useState, useEffect } from "react";
import { useReportCards } from "@/hooks/useReportCards";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp, Award, AlertCircle, MessageSquareWarning, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DisputeForm } from "@/components/disputes/DisputeForm";
import { DisputeManagement } from "@/components/disputes/DisputeManagement";
import { supabase } from "@/integrations/supabase/client";

export const ReportCardDashboard: React.FC = () => {
  const { reportCards, trendData, performanceSummary, loading, error, fetchTrendData, fetchPerformanceSummary, refetch } = useReportCards();
  const { canManageUsers } = useUserRoles();
  const { user } = useAuth();

  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [activeTab, setActiveTab] = useState<string>("report-cards");

  // Dispute state
  const [selectedReportCard, setSelectedReportCard] = useState<any>(null);
  const [disputeFormOpen, setDisputeFormOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [disputeStatuses, setDisputeStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTrendData();
    fetchPerformanceSummary();
    fetchDisputeStatuses();
  }, []);

  // Fetch dispute statuses for all report cards
  const fetchDisputeStatuses = async () => {
    try {
      const { data } = await supabase
        .from('score_disputes')
        .select('report_card_id, status')
        .in('status', ['pending', 'under_review', 'approved', 'partially_approved', 'rejected']);

      if (data) {
        const statusMap: Record<string, string> = {};
        data.forEach((d: any) => {
          // Keep the most recent/relevant status
          if (!statusMap[d.report_card_id] || d.status === 'pending' || d.status === 'under_review') {
            statusMap[d.report_card_id] = d.status;
          }
        });
        setDisputeStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error fetching dispute statuses:', error);
    }
  };

  const handleDisputeClick = (reportCard: any) => {
    setSelectedReportCard(reportCard);
    setDisputeFormOpen(true);
  };

  const handleDisputeSubmitted = () => {
    fetchDisputeStatuses();
    refetch?.();
  };

  const getDisputeStatusBadge = (reportCardId: string) => {
    const status = disputeStatuses[reportCardId];
    if (!status) return null;

    const configs: Record<string, { label: string; className: string }> = {
      pending: { label: 'Dispute Pending', className: 'bg-yellow-100 text-yellow-800' },
      under_review: { label: 'Under Review', className: 'bg-blue-100 text-blue-800' },
      approved: { label: 'Dispute Approved', className: 'bg-green-100 text-green-800' },
      partially_approved: { label: 'Partially Approved', className: 'bg-teal-100 text-teal-800' },
      rejected: { label: 'Dispute Rejected', className: 'bg-red-100 text-red-800' },
    };

    const config = configs[status];
    if (!config) return null;

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Show error state if database tables don't exist
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-6 h-6" />
              Database Setup Required
            </CardTitle>
            <CardDescription className="text-yellow-700">
              The report cards feature requires database tables that haven't been created yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-yellow-800">
            <p className="mb-4">{error}</p>
            <div className="p-4 bg-white rounded-lg border border-yellow-200">
              <h4 className="font-semibold mb-2">Quick Fix:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Open your Supabase Dashboard at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">supabase.com/dashboard</a></li>
                <li>Go to SQL Editor (left sidebar)</li>
                <li>Copy the contents of <code className="bg-yellow-100 px-1 py-0.5 rounded">supabase/migrations/20251117_ai_audit_system.sql</code></li>
                <li>Paste and run the SQL in the editor</li>
                <li>Refresh this page</li>
              </ol>
              <p className="mt-4 text-xs">
                See <code className="bg-yellow-100 px-1 py-0.5 rounded">APPLY_MIGRATION.md</code> for detailed instructions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get unique teams
  const teams = Array.from(new Set(reportCards.map((rc) => rc.profiles?.team).filter(Boolean)));

  // Filter report cards
  let filteredReportCards = reportCards;

  if (selectedTeam !== "all") {
    filteredReportCards = filteredReportCards.filter(
      (rc) => rc.profiles?.team === selectedTeam
    );
  }

  if (selectedEmployee !== "all") {
    filteredReportCards = filteredReportCards.filter(
      (rc) => rc.user_id === selectedEmployee
    );
  }

  // Sort report cards
  if (sortBy === "score") {
    filteredReportCards = [...filteredReportCards].sort(
      (a, b) => b.overall_score - a.overall_score
    );
  } else {
    filteredReportCards = [...filteredReportCards].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Calculate averages
  const avgOverall =
    filteredReportCards.length > 0
      ? Math.round(
          filteredReportCards.reduce((sum, rc) => sum + rc.overall_score, 0) /
            filteredReportCards.length
        )
      : 0;

  const avgCommunication =
    filteredReportCards.length > 0
      ? Math.round(
          filteredReportCards.reduce(
            (sum, rc) => sum + (rc.communication_score || 0),
            0
          ) / filteredReportCards.length
        )
      : 0;

  const avgCompliance =
    filteredReportCards.length > 0
      ? Math.round(
          filteredReportCards.reduce(
            (sum, rc) => sum + (rc.compliance_score || 0),
            0
          ) / filteredReportCards.length
        )
      : 0;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  // Format trend data for chart
  const chartData = trendData.map((item) => ({
    date: new Date(item.created_at).toLocaleDateString(),
    score: item.overall_score,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Cards</h1>
          <p className="text-[var(--color-subtext)] mt-1">
            {canManageUsers()
              ? "View AI audit scores and performance metrics for all agents"
              : "View your AI audit scores and performance history"}
          </p>
        </div>
      </div>

      {/* Tabs for managers */}
      {canManageUsers() ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="report-cards">Report Cards</TabsTrigger>
            <TabsTrigger value="disputes" className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              Score Disputes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="report-cards" className="mt-6">
            {renderReportCardsContent()}
          </TabsContent>

          <TabsContent value="disputes" className="mt-6">
            <DisputeManagement />
          </TabsContent>
        </Tabs>
      ) : (
        renderReportCardsContent()
      )}

      {/* Dispute Form Dialog */}
      {selectedReportCard && (
        <DisputeForm
          reportCard={selectedReportCard}
          open={disputeFormOpen}
          onClose={() => {
            setDisputeFormOpen(false);
            setSelectedReportCard(null);
          }}
          onSubmitted={handleDisputeSubmitted}
        />
      )}
    </div>
  );

  function renderReportCardsContent() {
    return (
      <div className="space-y-6">

      {/* Filters */}
      {canManageUsers() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Team</label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team} value={team!}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {Array.from(
                      new Set(reportCards.map((rc) => rc.user_id))
                    ).map((userId) => {
                      const rc = reportCards.find((r) => r.user_id === userId);
                      return (
                        <SelectItem key={userId} value={userId}>
                          {rc?.profiles?.first_name} {rc?.profiles?.last_name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date (Newest First)</SelectItem>
                    <SelectItem value="score">Score (Highest First)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4" />
              Average Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${getScoreColor(avgOverall)}`}>{avgOverall}/100</p>
            <p className="text-sm text-[var(--color-subtext)] mt-1">
              From {filteredReportCards.length} audits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Communication Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${getScoreColor(avgCommunication)}`}>
              {avgCommunication}/100
            </p>
            <p className="text-sm text-[var(--color-subtext)] mt-1">Average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${getScoreColor(avgCompliance)}`}>
              {avgCompliance}/100
            </p>
            <p className="text-sm text-[var(--color-subtext)] mt-1">Average</p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Overall score over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  name="Overall Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Report Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Audits</CardTitle>
          <CardDescription>
            {filteredReportCards.length} audit{filteredReportCards.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--color-surface)]">
                <tr>
                  {canManageUsers() && <th className="text-left p-3 font-semibold">Agent</th>}
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Source</th>
                  <th className="text-left p-3 font-semibold">Overall</th>
                  <th className="text-left p-3 font-semibold">Communication</th>
                  <th className="text-left p-3 font-semibold">Compliance</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportCards.length === 0 ? (
                  <tr>
                    <td colSpan={canManageUsers() ? 8 : 7} className="p-8 text-center text-[var(--color-subtext)]">
                      No report cards found
                    </td>
                  </tr>
                ) : (
                  filteredReportCards.map((rc, index) => {
                    const hasDispute = disputeStatuses[rc.id];
                    const canDispute = !canManageUsers() && rc.user_id === user?.id && !hasDispute;
                    const isExpanded = expandedRow === rc.id;

                    return (
                      <React.Fragment key={rc.id}>
                        <tr
                          className={`${index % 2 === 0 ? "bg-[var(--color-bg)]" : "bg-[var(--color-surface)]"} ${
                            isExpanded ? "border-b-0" : ""
                          }`}
                        >
                          {canManageUsers() && (
                            <td className="p-3">
                              <div>
                                <p className="font-medium">
                                  {rc.profiles?.first_name} {rc.profiles?.last_name}
                                </p>
                                <p className="text-sm text-[var(--color-subtext)]">{rc.profiles?.team || "No Team"}</p>
                              </div>
                            </td>
                          )}
                          <td className="p-3 text-sm">
                            {new Date(rc.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-sm">{rc.source_file || "N/A"}</td>
                          <td className="p-3">
                            <span className={`font-bold ${getScoreColor(rc.overall_score)}`}>
                              {rc.overall_score}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={rc.communication_score ? getScoreColor(rc.communication_score) : ""}>
                              {rc.communication_score || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={rc.compliance_score ? getScoreColor(rc.compliance_score) : ""}>
                              {rc.compliance_score || "-"}
                            </span>
                          </td>
                          <td className="p-3">
                            {getDisputeStatusBadge(rc.id) || (
                              <Badge variant="outline" className="text-green-700 border-green-300">
                                Final
                              </Badge>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setExpandedRow(isExpanded ? null : rc.id)}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {canDispute && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDisputeClick(rc)}
                                  className="text-[var(--color-accent)] border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                                >
                                  <MessageSquareWarning className="h-4 w-4 mr-1" />
                                  Dispute
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Expanded Row with Details */}
                        {isExpanded && (
                          <tr className={index % 2 === 0 ? "bg-[var(--color-bg)]" : "bg-[var(--color-surface)]"}>
                            <td colSpan={canManageUsers() ? 8 : 7} className="p-4 border-t border-[var(--color-border)]">
                              <div className="space-y-4">
                                {/* Feedback */}
                                {rc.feedback && (
                                  <div>
                                    <h4 className="font-medium mb-1">Feedback</h4>
                                    <p className="text-sm text-[var(--color-subtext)]">{rc.feedback}</p>
                                  </div>
                                )}

                                {/* Score Breakdown */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {rc.tone_score && (
                                    <div className="bg-[var(--color-surface)] p-3 rounded-lg">
                                      <p className="text-xs text-[var(--color-subtext)]">Tone</p>
                                      <p className={`text-xl font-bold ${getScoreColor(rc.tone_score)}`}>
                                        {rc.tone_score}
                                      </p>
                                    </div>
                                  )}
                                  {rc.empathy_score && (
                                    <div className="bg-[var(--color-surface)] p-3 rounded-lg">
                                      <p className="text-xs text-[var(--color-subtext)]">Empathy</p>
                                      <p className={`text-xl font-bold ${getScoreColor(rc.empathy_score)}`}>
                                        {rc.empathy_score}
                                      </p>
                                    </div>
                                  )}
                                  {rc.accuracy_score && (
                                    <div className="bg-[var(--color-surface)] p-3 rounded-lg">
                                      <p className="text-xs text-[var(--color-subtext)]">Accuracy</p>
                                      <p className={`text-xl font-bold ${getScoreColor(rc.accuracy_score)}`}>
                                        {rc.accuracy_score}
                                      </p>
                                    </div>
                                  )}
                                  {rc.resolution_score && (
                                    <div className="bg-[var(--color-surface)] p-3 rounded-lg">
                                      <p className="text-xs text-[var(--color-subtext)]">Resolution</p>
                                      <p className={`text-xl font-bold ${getScoreColor(rc.resolution_score)}`}>
                                        {rc.resolution_score}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Strengths & Improvements */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {rc.strengths && rc.strengths.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-2 text-green-700">Strengths</h4>
                                      <ul className="list-disc list-inside text-sm space-y-1">
                                        {rc.strengths.map((s: string, i: number) => (
                                          <li key={i} className="text-[var(--color-subtext)]">{s}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {rc.areas_for_improvement && rc.areas_for_improvement.length > 0 && (
                                    <div>
                                      <h4 className="font-medium mb-2 text-amber-700">Areas for Improvement</h4>
                                      <ul className="list-disc list-inside text-sm space-y-1">
                                        {rc.areas_for_improvement.map((a: string, i: number) => (
                                          <li key={i} className="text-[var(--color-subtext)]">{a}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Dispute Button for agents */}
                                {canDispute && (
                                  <div className="pt-2 border-t border-[var(--color-border)]">
                                    <Button
                                      onClick={() => handleDisputeClick(rc)}
                                      className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
                                    >
                                      <MessageSquareWarning className="h-4 w-4 mr-2" />
                                      Dispute This Score
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }
};
