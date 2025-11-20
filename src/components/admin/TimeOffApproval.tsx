import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, User, Clock, Filter } from "lucide-react";
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
import { useTimeOffApproval } from "@/hooks/useTimeOffApproval";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO } from "date-fns";
import { ApprovalActionDialog } from "./ApprovalActionDialog";
import { TimeOffCalendar } from "@/components/calendar/TimeOffCalendar";
import { TimeOffRequest } from "@/types/timeOffApproval";
import { useAllTimeOffRequests } from "@/hooks/useAllTimeOffRequests";
import { ExceptionActionDialog } from "./ExecptionActionDialog";

interface TimeOffApprovalProps {
  onBack: () => void;
}

export const TimeOffApproval = ({ onBack }: TimeOffApprovalProps) => {
  const {
    fetchPendingRequests,
    approveRequest,
    denyRequest,
    exceptionRequest,
    loading,
  } = useTimeOffApproval();
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<TimeOffRequest[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const { requests, refetch } = useAllTimeOffRequests();

  useEffect(() => {
    if (user) {
      loadRequests();
    }
  }, [user]);

  const loadRequests = async () => {
    setFetchLoading(true);
    try {
      const data = await fetchPendingRequests();
      setPendingRequests(data);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleApprove = async (requestId: string, notes?: string) => {
    try {
      await approveRequest(requestId, notes);
      await loadRequests(); // Refresh the list
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDeny = async (requestId: string, notes?: string) => {
    try {
      await denyRequest(requestId, notes);
      await loadRequests(); // Refresh the list
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleException = async (requestId: string, notes?: string) => {
    try {
      await exceptionRequest(requestId, notes);
      await loadRequests(); // Refresh the list
    } catch (error) {
      // Error already handled in hook
    }
  };

  const getEmployeeName = (request: TimeOffRequest) => {
    if (request.profiles?.first_name || request.profiles?.last_name) {
      return `${request.profiles?.first_name || ""} ${
        request.profiles?.last_name || ""
      }`.trim();
    }
    return request.profiles?.email || "Unknown";
  };

  // Get unique teams from requests
  const teams = [
    ...new Set(pendingRequests.map((r) => r.profiles?.team).filter(Boolean)),
  ].sort();

  // Filter requests by selected team
  const filteredRequests =
    selectedTeam === "all"
      ? pendingRequests
      : pendingRequests.filter(
          (request) => request.profiles?.team === selectedTeam,
        );

  console.log(filteredRequests);
  if (fetchLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading requests...</div>
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="rounded-sm text-inherit bg-slate-300 hover:bg-slate-200"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Time Off Approvals
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Team Filter */}
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filter by Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select team" />
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
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Column - Pending Requests */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Pending Time Off Requests ({filteredRequests.length})
                </CardTitle>
                <p className="text-xs">
                  <i>
                    **Exceptions are for time off that doesn't count towards an
                    employees PTO and UTO balance
                  </i>
                </p>
              </CardHeader>
              <CardContent>
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedTeam === "all"
                      ? "No pending time off requests."
                      : `No pending time off requests for ${selectedTeam} team.`}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-6 space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">
                                {getEmployeeName(request)}
                              </span>
                              <Badge
                                variant={
                                  request.request_type === "PTO"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {request.request_type}
                              </Badge>
                              {request.profiles?.team && (
                                <Badge variant="outline">
                                  {request.profiles.team}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {format(
                                  parseISO(request.start_date),
                                  "MMM dd, yyyy",
                                )}{" "}
                                -{" "}
                                {format(
                                  parseISO(request.end_date),
                                  "MMM dd, yyyy",
                                )}
                              </span>
                              <span className="font-medium">
                                ({request.days_requested} day
                                {request.days_requested !== 1 ? "s" : ""})
                              </span>
                            </div>

                            {request.reason && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">
                                  Reason:
                                </span>
                                <p className="mt-1 text-gray-600">
                                  {request.reason}
                                </p>
                              </div>
                            )}

                            <div className="text-xs text-gray-500">
                              Submitted{" "}
                              {format(
                                parseISO(request.created_at),
                                "MMM dd, yyyy 'at' h:mm a",
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <ApprovalActionDialog
                              action="approve"
                              onConfirm={(notes) =>
                                handleApprove(request.id, notes)
                              }
                              loading={loading}
                            />
                            <ApprovalActionDialog
                              action="deny"
                              onConfirm={(notes) =>
                                handleDeny(request.id, notes)
                              }
                              loading={loading}
                            />
                            <div className="col-start-2">
                              <ExceptionActionDialog
                                onConfirm={(notes) =>
                                  handleException(request.id, notes)
                                }
                                loading={loading}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Calendar */}
          <div>
            <TimeOffCalendar
              className="sticky top-8"
              externalSelectedTeam={selectedTeam}
              requests={requests}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
