import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatHours } from "./ShiftReportUtils";
import { Calendar } from "lucide-react";

interface WeeklyHoursData {
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  employees: Array<{
    name: string;
    email: string;
    regularHours: number;
    otHours: number;
    totalHours: number;
  }>;
}

interface WeeklyHoursReportProps {
  weeklyHoursReport: WeeklyHoursData[];
}

export const WeeklyHoursReport = ({
  weeklyHoursReport,
}: WeeklyHoursReportProps) => {
  // Calculate totals for each week
  const getWeekTotals = (employees: WeeklyHoursData['employees']) => {
    return employees.reduce(
      (acc, emp) => ({
        regularHours: acc.regularHours + emp.regularHours,
        otHours: acc.otHours + emp.otHours,
        totalHours: acc.totalHours + emp.totalHours,
      }),
      { regularHours: 0, otHours: 0, totalHours: 0 }
    );
  };

  return (
    <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
      <CardHeader>
        <CardTitle className="text-[var(--color-text)]">Weekly Hours Report</CardTitle>
        <p className="text-sm text-[var(--color-subtext)]">
          Shows regular hours (up to 40), overtime hours (over 40), and total
          hours for each calendar week.
        </p>
      </CardHeader>
      <CardContent>
        {weeklyHoursReport.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-subtext)]">
            No shift data available for weekly hours calculation
          </div>
        ) : (
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="sticky top-0 bg-[var(--color-surface)] z-10">
                <TableRow className="border-b border-[var(--color-border)]">
                  <TableHead className="text-[var(--color-text)]">Employee</TableHead>
                  <TableHead className="text-right text-[var(--color-text)]">Regular Hours</TableHead>
                  <TableHead className="text-right text-[var(--color-text)]">OT Hours</TableHead>
                  <TableHead className="text-right text-[var(--color-text)]">Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyHoursReport.map((week) => {
                  const totals = getWeekTotals(week.employees);
                  return (
                    <>
                      {/* Week Header Row */}
                      <TableRow
                        key={`header-${week.weekLabel}`}
                        className="bg-[var(--color-bg)] border-t-2 border-[var(--color-border)]"
                      >
                        <TableCell colSpan={4} className="py-3">
                          <div className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                            <Calendar className="h-4 w-4 text-[var(--color-accent)]" />
                            {week.weekLabel}
                            <span className="ml-auto text-sm font-normal text-[var(--color-subtext)]">
                              {week.employees.length} employee{week.employees.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Employee Rows */}
                      {week.employees.map((emp, idx) => (
                        <TableRow
                          key={`${week.weekLabel}-${idx}`}
                          className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]/50"
                        >
                          <TableCell className="text-[var(--color-text)]">{emp.name}</TableCell>
                          <TableCell className="text-right text-[var(--color-text)]">
                            {formatHours(emp.regularHours)}
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.otHours > 0 ? (
                              <span className="text-orange-600 font-medium">
                                {formatHours(emp.otHours)}
                              </span>
                            ) : (
                              <span className="text-[var(--color-subtext)]">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium text-[var(--color-text)]">
                            {formatHours(emp.totalHours)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Week Totals Row */}
                      {week.employees.length > 1 && (
                        <TableRow
                          key={`totals-${week.weekLabel}`}
                          className="bg-[var(--color-bg)]/50 border-b border-[var(--color-border)]"
                        >
                          <TableCell className="text-[var(--color-subtext)] italic">
                            Week Total
                          </TableCell>
                          <TableCell className="text-right text-[var(--color-subtext)] italic">
                            {formatHours(totals.regularHours)}
                          </TableCell>
                          <TableCell className="text-right text-[var(--color-subtext)] italic">
                            {totals.otHours > 0 ? formatHours(totals.otHours) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium text-[var(--color-subtext)] italic">
                            {formatHours(totals.totalHours)}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
