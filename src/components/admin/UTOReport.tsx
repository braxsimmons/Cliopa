import { useState } from "react";
import { ArrowLeft, Filter, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUTOReport, UTOReportEntry } from "@/hooks/useUTOReport";
import { format, parseISO } from "date-fns";

interface UTOReportProps {
  onBack: () => void;
}

export const UTOReport = ({ onBack }: UTOReportProps) => {
  const { requests, loading } = useUTOReport();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Approved
          </Badge>
        );
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      case "exception":
        return (
          <Badge variant="default" className="bg-green-100 text-white-400">
            Exception
          </Badge>
        );
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getEmployeeName = (request: UTOReportEntry) => {
    if (request.profiles?.first_name || request.profiles?.last_name) {
      return `${request.profiles?.first_name || ""} ${
        request.profiles?.last_name || ""
      }`.trim();
    }
    return request.profiles?.email || "Unknown";
  };

  const filteredRequests = requests.filter((request) => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false;
    if (typeFilter !== "all" && request.request_type !== typeFilter)
      return false;
    if (teamFilter !== "all" && request.profiles?.team !== teamFilter)
      return false;
    if (userFilter !== "all" && request.user_id !== userFilter) return false;
    return true;
  });

  const uniqueTeams = [
    ...new Set(requests.map((r) => r.profiles?.team).filter(Boolean)),
  ];
  const uniqueUsers = Array.from(
    new Map(requests.map((r) => [r.user_id, getEmployeeName(r)])).entries(),
  )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const getStatusCounts = () => {
    const counts = {
      total: filteredRequests.length,
      pending: filteredRequests.filter((r) => r.status === "pending").length,
      approved: filteredRequests.filter((r) => r.status === "approved").length,
      denied: filteredRequests.filter((r) => r.status === "denied").length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading UTO & PTO report...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                UTO & PTO Request Report
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{statusCounts.total}</div>
              <div className="text-sm text-gray-600">Total Requests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {statusCounts.pending}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {statusCounts.approved}
              </div>
              <div className="text-sm text-gray-600">Approved</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {statusCounts.denied}
              </div>
              <div className="text-sm text-gray-600">Denied</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="exception">Exception</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="PTO">PTO</SelectItem>
                    <SelectItem value="UTO">UTO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Team</label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {uniqueTeams.map((team) => (
                      <SelectItem key={team} value={team!}>
                        {team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Employee
                </label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {uniqueUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              All UTO & PTO Requests ({filteredRequests.length})
            </CardTitle>
            <p className="text-sm text-gray-600">
              Complete log of all time off requests including pending, approved,
              and denied requests.
            </p>
          </CardHeader>
          <CardContent>
            {filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No time off requests found with current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">
                              {getEmployeeName(request)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{request.profiles?.team || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              request.request_type === "PTO"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {request.request_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              {format(
                                parseISO(request.start_date),
                                "MMM dd, yyyy",
                              )}
                            </div>
                            <div className="text-gray-500">
                              to{" "}
                              {format(
                                parseISO(request.end_date),
                                "MMM dd, yyyy",
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {request.days_requested}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {format(parseISO(request.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate text-sm">
                            {request.reason || "-"}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
