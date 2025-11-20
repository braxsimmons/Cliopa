import React, { useState, useEffect } from "react";
import { useReportCards } from "@/hooks/useReportCards";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Award, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export const ReportCardDashboard: React.FC = () => {
  const { reportCards, trendData, performanceSummary, loading, error, fetchTrendData, fetchPerformanceSummary } = useReportCards();
  const { canManageUsers } = useUserRoles();

  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");

  useEffect(() => {
    fetchTrendData();
    fetchPerformanceSummary();
  }, []);

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
      <div>
        <h1 className="text-3xl font-bold">Report Cards</h1>
        <p className="text-[var(--color-subtext)] mt-1">
          {canManageUsers()
            ? "View AI audit scores and performance metrics for all agents"
            : "View your AI audit scores and performance history"}
        </p>
      </div>

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
                  <th className="text-left p-3 font-semibold">Feedback</th>
                </tr>
              </thead>
              <tbody>
                {filteredReportCards.length === 0 ? (
                  <tr>
                    <td colSpan={canManageUsers() ? 7 : 6} className="p-8 text-center text-[var(--color-subtext)]">
                      No report cards found
                    </td>
                  </tr>
                ) : (
                  filteredReportCards.map((rc, index) => (
                    <tr
                      key={rc.id}
                      className={index % 2 === 0 ? "bg-[var(--color-bg)]" : "bg-[var(--color-surface)]"}
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
                      <td className="p-3 text-sm text-[var(--color-subtext)] max-w-xs truncate">
                        {rc.feedback || "No feedback"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
