import { useState } from "react";
import { History, Edit, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRecentShifts } from "@/hooks/useRecentShifts";
import { TimeCorrectionDialog } from "./TimeCorrectionDialog";
import { ManualShiftDialog } from "./ManualShiftDialog";

// Utility for formatting hours/minutes
const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

type StatusLabelProps = {
  entry: import("@/hooks/useRecentShifts").RecentShiftEntry;
  verified?: boolean;
};

// Helper for status text with proper CSS classes
const ShiftStatus = ({ entry, verified }: StatusLabelProps) => {
  if (entry.request_type?.toUpperCase() === "UTO") {
    return (
      <span
        className="status-pill"
        style={{ backgroundColor: "#DBEAFE", color: "#1E40AF" }}
      >
        Unpaid Leave
      </span>
    );
  } else if (entry.request_type?.toUpperCase() === "PTO") {
    return (
      <span
        className="status-pill"
        style={{ backgroundColor: "#DCFCE7", color: "#166534" }}
      >
        Paid Leave
      </span>
    );
  }

  if (entry.status === "pending") {
    return (
      <span className="status-pill status-correction-pending">
        Correction Pending
      </span>
    );
  }

  if (entry.status === "approved") {
    return (
      <span className="status-pill status-correction-approved">
        Correction Approved
      </span>
    );
  }

  if (entry.status === "denied") {
    return (
      <span className="status-pill status-correction-denied">
        Correction Denied
      </span>
    );
  }

  if (
    entry.status === "completed" ||
    entry.status === "auto_ended" ||
    entry.status === "manual_ended"
  ) {
    if (verified) {
      return (
        <span className="status-pill status-completed-verified">
          Complete (Verified)
        </span>
      );
    } else {
      return (
        <span className="status-pill status-completed-unverified">
          Complete (Unverified)
        </span>
      );
    }
  }

  return <span className="text-muted-foreground">—</span>;
};

const typeText = (
  entry: import("@/hooks/useRecentShifts").RecentShiftEntry
) => {
  if (entry.request_type === "shift") return "Shift";
  if ((entry.request_type || "").toUpperCase() === "UTO") return "UTO";
  return "PTO";
};

export const ShiftTable = () => {
  const { entries, loading, VerifyShift } = useRecentShifts();
  const [manualEntry, setManualEntry] = useState(false);

  const [correctionOpenFor, setCorrectionOpenFor] = useState<null | {
    id: string;
    endTime: Date;
    startTime: Date;
    team: string;
    shift_type: string;
  }>(null);

  const toggleVerified = (id: string) => {
    VerifyShift(id);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Shifts
            </div>
            <Button
              onClick={() => setManualEntry(true)}
              size="sm"
              variant="outline"
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              Forgot to Clock in?
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">Date</TableHead>
                  <TableHead className="min-w-[100px]">Start</TableHead>
                  <TableHead className="min-w-[100px]">End</TableHead>
                  <TableHead className="min-w-[100px]">Duration</TableHead>
                  <TableHead className="min-w-[80px]">Type</TableHead>
                  <TableHead className="min-w-[80px]">Team</TableHead>
                  <TableHead className="min-w-[80px]">Shift Type</TableHead>
                  <TableHead className="min-w-[160px]">Status</TableHead>
                  <TableHead className="text-center min-w-[80px]">
                    Edit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  if (entry.request_type === "shift") {
                    const canEdit = !!entry.end_time;
                    const isVerified =
                      entry.verified !== null ||
                      entry.status === "auto_ended" ||
                      entry.status === "manual_ended";
                    const isUnreviewed = !isVerified;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.start_time).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "numeric",
                              day: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(entry.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {entry.end_time
                            ? new Date(entry.end_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {entry.total_hours != null
                            ? formatHours(entry.total_hours)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="type-pill">{typeText(entry)}</span>
                        </TableCell>
                        <TableCell>
                          <span>{entry.team}</span>
                        </TableCell>
                        <TableCell>
                          <span>{entry.shift_type}</span>
                        </TableCell>
                        <TableCell>
                          <ShiftStatus entry={entry} verified={isVerified} />
                        </TableCell>
                        <TableCell className="text-center">
                          {canEdit ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit shift"
                              onClick={() =>
                                setCorrectionOpenFor({
                                  id: entry.id,
                                  endTime: new Date(entry.end_time!),
                                  team: entry.team,
                                  startTime: new Date(entry.start_time!),
                                  shift_type: entry.shift_type,
                                })
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  } else if (entry.request_type === "PTO") {
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {new Date(entry.start_time).toLocaleDateString(
                            undefined,
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "numeric",
                              day: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(entry.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {new Date(entry.end_time!).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          {formatHours(entry.total_hours ?? 8)}
                        </TableCell>
                        <TableCell>
                          <span className="type-pill">{typeText(entry)}</span>
                        </TableCell>
                        <TableCell>
                          <ShiftStatus entry={entry} />
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-gray-400">—</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-gray-400">—</span>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return null;
                })}
                {!loading && entries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-sm text-gray-500"
                    >
                      No shifts recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {correctionOpenFor && (
        <TimeCorrectionDialog
          isOpen={!!correctionOpenFor}
          onClose={() => setCorrectionOpenFor(null)}
          timeEntryId={correctionOpenFor.id}
          originalShiftType={correctionOpenFor.shift_type}
          originalEndTime={correctionOpenFor.endTime}
          originalStartTime={correctionOpenFor.startTime}
          originalTeam={correctionOpenFor.team}
        />
      )}
      {manualEntry === true && (
        <ManualShiftDialog
          isOpen={manualEntry}
          onClose={() => setManualEntry(false)}
        />
      )}
    </>
  );
};
