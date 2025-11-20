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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Hours Report</CardTitle>
        <p className="text-sm text-gray-600">
          Shows regular hours (up to 40), overtime hours (over 40), and total
          hours for each calendar week.
        </p>
      </CardHeader>
      <CardContent>
        {weeklyHoursReport.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No shift data available for weekly hours calculation
          </div>
        ) : (
          <div className="space-y-6">
            {weeklyHoursReport.map((week) => (
              <div key={week.weekLabel} className="border rounded-lg p-4">
                <h4 className="font-medium text-lg mb-3">{week.weekLabel}</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">
                        Regular Hours
                      </TableHead>
                      <TableHead className="text-right">OT Hours</TableHead>
                      <TableHead className="text-right">Total Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.employees.map((emp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{emp.name}</TableCell>
                        <TableCell className="text-right">
                          {formatHours(emp.regularHours)}
                        </TableCell>
                        <TableCell className="text-right">
                          {emp.otHours > 0 ? formatHours(emp.otHours) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHours(emp.totalHours)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
