import { Badge } from "@/components/ui/badge";
import { ShiftReportEntry } from "@/hooks/useShiftReport";
import { format } from "date-fns";

export const formatHours = (hours: number) => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

export const getEntryTypeBadge = (entry: ShiftReportEntry) => {
  if (entry.entry_type === "time_off_pto") {
    return <Badge variant="default">{"PTO"}</Badge>;
  } else if (entry.entry_type === "time_off_uto") {
    return <Badge variant="default">{"UTO"}</Badge>
  }
  return <Badge variant="outline">Shift</Badge>;
};

export const getShiftStatusBadge = (entry: ShiftReportEntry) => {
  if (entry.entry_type === "time_off_pto") {
    return <Badge variant="secondary">Approved PTO</Badge>;
  }
  else if (entry.entry_type === "time_off_uto") {
    return <Badge variant="secondary">Approved UTO</Badge>;
  }

  // For actual shifts, show completion status
  if (entry.verified === null) {
    return <Badge variant="default">Completed (Unverified)</Badge>
  } else {
    return <Badge variant="default">Completed (Verified)</Badge>;
  }
};

export const formatWeekRange = (start: Date, end: Date) => {
  const sameYear = start.getFullYear() === end.getFullYear();
  const startFormat = sameYear ? "MMM dd" : "MMM dd, yyyy";
  return `${format(start, startFormat)} - ${format(end, "MMM dd, yyyy")}`;
};
