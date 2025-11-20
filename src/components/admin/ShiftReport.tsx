import { useState, useMemo } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftReportEntry, useShiftReport } from "@/hooks/useShiftReport";
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import { ShiftReportFilters } from "./ShiftReportFilters";
import { WeeklyHoursReport } from "./WeeklyHoursReport";
import { ShiftReportTable } from "./ShiftReportTable";
import { formatWeekRange } from "./ShiftReportUtils";
import { ShiftReportCSVDialog } from "./ShiftReportCSVDialogs";

interface ShiftReportProps {
  onBack: () => void;
}

export const ShiftReport = ({ onBack }: ShiftReportProps) => {
  const { shifts, loading } = useShiftReport();

  const [entryTypeFilter, setEntryTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showShiftReportCSVDownload, setShowShiftReportCSVDownload] =
    useState(false);

  const filteredAndSortedShifts = useMemo(() => {
    let data = shifts.filter((shift) => {
      if (entryTypeFilter !== "all" && shift.entry_type !== entryTypeFilter) {
        return false;
      }
      if (startDate && new Date(shift.start_time) < startDate) return false;
      if (endDate && new Date(shift.start_time) > endDate) return false;
      if (employeeFilter) {
        const fullName = `${shift?.first_name || ""} ${
          shift?.last_name || ""
        }`.toLowerCase();
        const email = shift?.email?.toLowerCase() || "";
        const search = employeeFilter.toLowerCase();
        if (!fullName.includes(search) && !email.includes(search)) {
          return false;
        }
      }
      return true;
    });

    data = data.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case "employee":
          aVal =
            a?.first_name ||
            a?.last_name ||
            a?.email ||
            a.profiles?.first_name ||
            a.profiles?.last_name ||
            a.profiles?.email ||
            "";
          bVal =
            b?.first_name ||
            b?.last_name ||
            b?.email ||
            b.profiles?.first_name ||
            b.profiles?.last_name ||
            b.profiles?.email ||
            "";
          break;
        case "type":
          aVal = a.entry_type;
          bVal = b.entry_type;
          break;
        case "start":
          aVal = new Date(a.start_time).getTime();
          bVal = new Date(b.start_time).getTime();
          break;
        case "end":
          aVal = a.end_time ? new Date(a.end_time).getTime() : 0;
          bVal = b.end_time ? new Date(b.end_time).getTime() : 0;
          break;
        case "hours":
          aVal = a.total_hours ?? 0;
          bVal = b.total_hours ?? 0;
          break;
        default:
          aVal = new Date(a.start_time).getTime();
          bVal = new Date(b.start_time).getTime();
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    shifts,
    entryTypeFilter,
    startDate,
    endDate,
    employeeFilter,
    sortField,
    sortDirection,
  ]);

  // Calculate weekly hours report
  const weeklyHoursReport = useMemo(() => {
    const weeklyData = new Map<
      string,
      { [employeeId: string]: { hours: number; name: string; email: string } }
    >();

    filteredAndSortedShifts.forEach((shift) => {
      if (shift.entry_type === "shift" && shift.total_hours) {
        const shiftDate = new Date(shift.start_time);
        const weekStart = startOfWeek(shiftDate, { weekStartsOn: 1 }); // Monday start
        const weekKey = format(weekStart, "yyyy-MM-dd");

        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, {});
        }

        const weekData = weeklyData.get(weekKey)!;
        const employeeId = shift.user_id;

        if (!weekData[employeeId]) {
          weekData[employeeId] = {
            hours: 0,
            name:
              shift?.first_name || shift?.last_name
                ? `${shift?.first_name || ""} ${shift?.last_name || ""}`.trim()
                : shift?.email || "Unknown",
            email: shift?.email || "",
          };
        }

        weekData[employeeId].hours += shift.total_hours;
      }
    });

    // Convert to array format with OT calculations
    const weeklyReport = Array.from(weeklyData.entries())
      .map(([weekKey, employees]) => {
        const adjustedDate = addDays(weekKey, 1);
        const weekStart = new Date(adjustedDate);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

        const employeeData = Object.values(employees).map((emp) => ({
          ...emp,
          regularHours: Math.min(emp.hours, 40),
          otHours: Math.max(0, emp.hours - 40),
          totalHours: emp.hours,
        }));

        return {
          weekStart,
          weekEnd,
          weekLabel: formatWeekRange(weekStart, weekEnd),
          employees: employeeData,
        };
      })
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());

    return weeklyReport;
  }, [filteredAndSortedShifts]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const convertToCSV = (data: ShiftReportEntry[]) => {
    if (!data || !data.length) return "";

    const keys = Object.keys(data[0]);
    const csvRows = [];

    // Add header row
    csvRows.push(keys.join(","));

    // Add data rows
    for (const row of data) {
      const values = keys.map((key) => row[key]);
      csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
  };

  // Utility function to trigger CSV download
  const downloadCSV = async (startTime: Date, endTime: Date) => {
    const csvData = [];
    for (const shift of shifts) {
      const shiftStart = new Date(shift.start_time);
      if (shiftStart >= startTime && shiftStart <= endTime) {
        const s = {
          firstName: shift.first_name
            ? shift.first_name
            : shift.profiles.first_name,
          lastName: shift.last_name
            ? shift.last_name
            : shift.profiles.last_name,
          email: shift.email ? shift.email : shift.profiles.email,
          type:
            shift.entry_type === "time_off_pto"
              ? "PTO"
              : shift.entry_type === "time_off_uto"
                ? "UTO"
                : shift.entry_type,
          team: shift.team,
          shift_type:
            shift.entry_type === "time_off_pto" ||
            shift.entry_type === "time_off_uto"
              ? "Time Off"
              : shift.shift_type,
          startTime:
            shift.entry_type !== "shift" || shift.start_time === null
              ? shift.start_time
              : format(parseISO(shift.start_time), "yyyy-MM-dd hh:mm a"),
          endTime:
            shift.entry_type !== "shift"
              ? shift.end_time
              : format(parseISO(shift.end_time), "yyyy-MM-dd hh:mm a"),
          totalHours:
            shift.entry_type === "time_off_pto"
              ? 8.0
              : shift.entry_type === "time_off_uto"
                ? 0.0
                : shift.total_hours,
          verified:
            shift.entry_type === "shift" && shift.verified !== null
              ? format(parseISO(shift.verified), "yyyy-MM-dd hh:mm a")
              : shift.verified,
          status:
            shift.entry_type === "time_off_pto"
              ? "Approved PTO"
              : shift.entry_type === "time_off_uto"
                ? "Approved UTO"
                : shift.verified !== null
                  ? "Completed (verified)"
                  : "Completed (unverified)",
        };
        csvData.push(s);
      }
    }
    const csv = convertToCSV(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Create a link and simulate a click to trigger download
    const filename =
      "shift_report_" +
      startTime.toISOString() +
      "_" +
      endTime.toISOString() +
      ".csv";
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.click();
    URL.revokeObjectURL(url); // Clean up the URL object

    setShowShiftReportCSVDownload(false);
  };

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
                Shift Report
              </h1>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowShiftReportCSVDownload(true)}
            >
              <Download className="h-4 w-2 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <ShiftReportFilters
          entryTypeFilter={entryTypeFilter}
          setEntryTypeFilter={setEntryTypeFilter}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          employeeFilter={employeeFilter}
          setEmployeeFilter={setEmployeeFilter}
        />

        <WeeklyHoursReport weeklyHoursReport={weeklyHoursReport} />

        <ShiftReportTable
          shifts={filteredAndSortedShifts}
          loading={loading}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        <ShiftReportCSVDialog
          isOpen={showShiftReportCSVDownload}
          onClose={() => setShowShiftReportCSVDownload(false)}
          onSumbit={(s, e) => downloadCSV(s, e)}
        />
      </main>
    </div>
  );
};
