import { useState, useEffect } from "react";
import { ArrowLeft, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { useTimeCorrections } from "@/hooks/useTimeCorrections";

interface TimeCorrectionApprovalsProps {
  onBack: () => void;
}

export const TimeCorrectionApprovals = ({
  onBack,
}: TimeCorrectionApprovalsProps) => {
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>(
    {}
  );
  const { fetchPendingCorrections, approveCorrection, denyCorrection } =
    useTimeCorrections();

  useEffect(() => {
    loadCorrections();
  }, []);

  const loadCorrections = async () => {
    setLoading(true);
    try {
      console.log("Loading time corrections...");

      const data = await fetchPendingCorrections();
      console.log("fetchPendingCorrections result:", data);
      setCorrections(data);
    } catch (error) {
      console.error("Error loading corrections:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (correctionId: string) => {
    const notes = approvalNotes[correctionId];
    const success = await approveCorrection(correctionId, notes);

    if (success) {
      await loadCorrections(); // Refresh the list
      setApprovalNotes((prev) => ({ ...prev, [correctionId]: "" }));
    }
  };

  const handleDeny = async (correctionId: string) => {
    const notes = approvalNotes[correctionId];
    const success = await denyCorrection(correctionId, notes);

    if (success) {
      await loadCorrections(); // Refresh the list
      setApprovalNotes((prev) => ({ ...prev, [correctionId]: "" }));
    }
  };

  const getEmployeeName = (correction: any) => {
    if (correction.first_name || correction.last_name) {
      return `${correction.first_name || ""} ${
        correction.last_name || ""
      }`.trim();
    }
    return correction.email || "Unknown Employee";
  };

  const calculateExtraHours = (
    currentStart: string | null,
    currentEnd: string | null,
    requestedStart: string | null,
    requestedEnd: string | null
  ) => {
    const currentStartTime = new Date(currentStart);
    const currentEndTime = new Date(currentEnd);
    const requestedStartTime = new Date(requestedStart);
    const requestedEndTime = new Date(requestedEnd);

    let diff = 0;

    if (requestedEnd) {
      diff += requestedEndTime.getTime() - currentEndTime.getTime();
    }
    if (requestedStart) {
      diff += currentStartTime.getTime() - requestedStartTime.getTime();
    }
    const differenceInSeconds = diff / 1000;
    const differenceInMinutes = differenceInSeconds / 60;
    const absoluteMinutes = Math.abs(differenceInMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = Math.round(absoluteMinutes % 60);
    const sign = differenceInMinutes < 0 ? "-" : "+";

    if (hours === 0) {
      return `${sign}${minutes} mins`;
    } else if (hours === 1) {
      return `${sign}${hours} hour ${minutes} mins`;
    } else {
      return `${sign}${hours} hours ${minutes} mins`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading time corrections...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Time Correction Approvals
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Time Corrections ({corrections.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {corrections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending time corrections found
              </div>
            ) : (
              <div className="space-y-6">
                {corrections.map((correction) => (
                  <div
                    key={correction.id}
                    className="border rounded-lg p-6 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {getEmployeeName(correction)}
                          </span>
                          <Badge variant="outline">Time Correction</Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">
                              Original Start Time:
                            </span>
                            <p className="text-gray-600">
                              {format(
                                parseISO(correction.original_start_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Original End Time:
                            </span>
                            <p className="text-gray-600">
                              {format(
                                parseISO(correction.original_end_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Original Shift Type:
                            </span>
                            <p className="text-gray-600">
                              {correction.original_shift_type}
                            </p>
                          </div>

                          <div>
                            <span className="font-medium text-gray-700">
                              Current Start Time:
                            </span>
                            <p className="text-gray-600">
                              {format(
                                parseISO(correction.current_start_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Current End Time:
                            </span>
                            <p className="text-gray-600">
                              {format(
                                parseISO(correction.current_end_time),
                                "MMM dd, yyyy 'at' h:mm a"
                              )}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Current Shift Type:
                            </span>
                            <p className="text-gray-600">
                              {correction.current_shift_type}
                            </p>
                          </div>

                          <div>
                            <span className="font-medium text-gray-700">
                              Requested Start Time:
                            </span>
                            <p className="text-gray-600">
                              {correction.requested_start_time
                                ? format(
                                    new Date(correction.requested_start_time),
                                    "MMM dd, yyyy 'at' h:mm a"
                                  )
                                : "----------"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Requested End Time:
                            </span>
                            <p className="text-gray-600">
                              {correction.requested_end_time
                                ? format(
                                    new Date(correction.requested_end_time),
                                    "MMM dd, yyyy 'at' h:mm a"
                                  )
                                : "----------"}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">
                              Requested Shift Type:
                            </span>
                            <p className="text-gray-600">
                              {correction.requested_shift_type
                                ? correction.requested_shift_type
                                : "----------"}
                            </p>
                          </div>
                        </div>

                        <div className="text-sm">
                          <span className="font-medium text-gray-700">
                            Additional Hours:
                          </span>
                          <span className="ml-2 text-blue-600 font-medium">
                            {calculateExtraHours(
                              correction.current_start_time,
                              correction.current_end_time,
                              correction.requested_start_time,
                              correction.requested_end_time
                            )}
                          </span>
                        </div>

                        <div className="text-sm">
                          <span className="font-medium text-gray-700">
                            Reason:
                          </span>
                          <p className="mt-1 text-gray-600 bg-gray-50 p-3 rounded">
                            {correction.reason}
                          </p>
                        </div>

                        <div className="text-xs text-gray-500">
                          Submitted{" "}
                          {format(
                            parseISO(correction.created_at),
                            "MMM dd, yyyy 'at' h:mm a"
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`notes-${correction.id}`}>
                            Notes (Optional)
                          </Label>
                          <Textarea
                            id={`notes-${correction.id}`}
                            placeholder="Add any notes about this approval..."
                            value={approvalNotes[correction.id] || ""}
                            onChange={(e) =>
                              setApprovalNotes((prev) => ({
                                ...prev,
                                [correction.id]: e.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="ml-6 flex gap-2">
                        <Button
                          onClick={() => handleApprove(correction.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => handleDeny(correction.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
