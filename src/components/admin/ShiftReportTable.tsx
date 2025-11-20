import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShiftReportEntry } from "@/hooks/useShiftReport";
import {
  formatHours,
  getEntryTypeBadge,
  getShiftStatusBadge,
} from "./ShiftReportUtils";

interface ShiftReportTableProps {
  shifts: ShiftReportEntry[];
  loading: boolean;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}

export const ShiftReportTable = ({
  shifts,
  loading,
  sortField,
  sortDirection,
  onSort,
}: ShiftReportTableProps) => {
  const getSortIcon = (field: string) => {
    if (sortField === field) {
      return sortDirection === "asc" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      );
    }
    return <ChevronsUpDown className="h-3 w-3" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completed Shifts & Time Off Taken</CardTitle>
        <p className="text-sm text-gray-600">
          This report shows only completed shifts and time off entries that have
          already occurred.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                onClick={() => onSort("employee")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  Employee
                  {getSortIcon("employee")}
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center gap-1">Email</div>
              </TableHead>
              <TableHead
                onClick={() => onSort("date")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  Date
                  {getSortIcon("date")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("type")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  Type
                  {getSortIcon("type")}
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Shift Type</TableHead>
              <TableHead
                onClick={() => onSort("start")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  Start Time
                  {getSortIcon("start")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("end")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  End Time
                  {getSortIcon("end")}
                </div>
              </TableHead>
              <TableHead
                onClick={() => onSort("hours")}
                className="cursor-pointer select-none"
              >
                <div className="flex items-center gap-1">
                  Total Hours
                  {getSortIcon("hours")}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift.id}>
                <TableCell>
                  {(shift?.first_name || shift?.last_name) && !shift.profiles
                    ? `${shift?.first_name || ""} ${
                        shift?.last_name || ""
                      }`.trim()
                    : shift?.email}

                  {shift.profiles?.first_name || shift.profiles?.last_name
                    ? `${shift.profiles?.first_name || ""} ${
                        shift.profiles?.last_name || ""
                      }`.trim()
                    : shift.profiles?.email}
                </TableCell>
                <TableCell>
                  {shift.profiles?.email ? shift.profiles?.email : shift.email}
                </TableCell>
                <TableCell>
                  {new Date(shift.start_time).toLocaleDateString()}
                </TableCell>
                <TableCell>{getEntryTypeBadge(shift)}</TableCell>
                <TableCell>{getShiftStatusBadge(shift)}</TableCell>
                <TableCell>{shift.team}</TableCell>
                <TableCell>
                  {shift.entry_type === "time_off_pto" ||
                  shift.entry_type === "time_off_uto"
                    ? "Time off"
                    : shift.shift_type}
                </TableCell>
                <TableCell>
                  {shift.entry_type === "time_off_pto" ||
                  shift.entry_type === "time_off_uto"
                    ? "All Day"
                    : new Date(shift.start_time).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  {shift.entry_type === "time_off_pto" ||
                  shift.entry_type === "time_off_uto"
                    ? "All Day"
                    : shift.end_time
                      ? new Date(shift.end_time).toLocaleTimeString()
                      : "-"}
                </TableCell>
                <TableCell>
                  {shift.total_hours != null
                    ? formatHours(shift.total_hours)
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
            {!loading && shifts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-sm text-gray-500"
                >
                  No completed shifts or taken time off found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
