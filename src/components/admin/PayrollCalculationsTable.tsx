import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollCalculation } from "@/hooks/usePayroll";

interface PayrollCalculationsTableProps {
  calculations: PayrollCalculation[];
}

export const PayrollCalculationsTable = ({
  calculations,
}: PayrollCalculationsTableProps) => {
  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatHours = (hours: number) => `${hours.toFixed(2)}h`;

  const getEmployeeName = (calc: PayrollCalculation) => {
    if (calc.profiles?.first_name || calc.profiles?.last_name) {
      return `${calc.profiles?.first_name || ""} ${
        calc.profiles?.last_name || ""
      }`.trim();
    }
    return calc.profiles?.email || "Unknown Employee";
  };

  const totalRegularHours = calculations.reduce(
    (sum, calc) => sum + calc.regular_hours,
    0,
  );
  const totalOvertimeHours = calculations.reduce(
    (sum, calc) => sum + calc.overtime_hours,
    0,
  );
  const totalHolidayHours = calculations.reduce(
    (sum, calc) => sum + calc.holiday_hours,
    0,
  );
  const totalPtoHours = calculations.reduce(
    (sum, calc) => sum + calc.pto_hours,
    0,
  );
  const totalRegularPay = calculations.reduce(
    (sum, calc) => sum + calc.regular_pay,
    0,
  );
  const totalOvertimePay = calculations.reduce(
    (sum, calc) => sum + calc.overtime_pay,
    0,
  );
  const totalHolidayPay = calculations.reduce(
    (sum, calc) => sum + calc.holiday_pay,
    0,
  );
  const totalPtoPay = calculations.reduce((sum, calc) => sum + calc.pto_pay, 0);
  const totalGrossPay = calculations.reduce(
    (sum, calc) => sum + calc.total_gross_pay,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Calculations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Hourly Rate</TableHead>
                <TableHead>Regular Hours</TableHead>
                <TableHead>OT Hours</TableHead>
                <TableHead>Holiday Hours</TableHead>
                <TableHead>PTO Hours</TableHead>
                <TableHead>Regular Pay</TableHead>
                <TableHead>OT Pay</TableHead>
                <TableHead>Holiday Pay</TableHead>
                <TableHead>PTO Pay</TableHead>
                <TableHead>Total Gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.map((calc) => (
                <TableRow key={calc.id}>
                  <TableCell className="font-medium">
                    {getEmployeeName(calc)}
                  </TableCell>
                  <TableCell>{formatCurrency(calc.hourly_rate)}</TableCell>
                  <TableCell>{formatHours(calc.regular_hours)}</TableCell>
                  <TableCell>
                    {calc.overtime_hours > 0 ? (
                      <Badge variant="secondary">
                        {formatHours(calc.overtime_hours)}
                      </Badge>
                    ) : (
                      formatHours(calc.overtime_hours)
                    )}
                  </TableCell>
                  <TableCell>{formatHours(calc.holiday_hours)}</TableCell>
                  <TableCell>{formatHours(calc.pto_hours)}</TableCell>
                  <TableCell>{formatCurrency(calc.regular_pay)}</TableCell>
                  <TableCell>
                    {calc.overtime_pay > 0 ? (
                      <Badge variant="default">
                        {formatCurrency(calc.overtime_pay)}
                      </Badge>
                    ) : (
                      formatCurrency(calc.overtime_pay)
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(calc.holiday_pay)}</TableCell>
                  <TableCell>{formatCurrency(calc.pto_pay)}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(calc.total_gross_pay)}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-gray-50 font-semibold">
                <TableCell>TOTALS</TableCell>
                <TableCell>-</TableCell>
                <TableCell>{formatHours(totalRegularHours)}</TableCell>
                <TableCell>{formatHours(totalOvertimeHours)}</TableCell>
                <TableCell>{formatHours(totalHolidayHours)}</TableCell>
                <TableCell>{formatHours(totalPtoHours)}</TableCell>
                <TableCell>{formatCurrency(totalRegularPay)}</TableCell>
                <TableCell>{formatCurrency(totalOvertimePay)}</TableCell>
                <TableCell>{formatCurrency(totalHolidayPay)}</TableCell>
                <TableCell>{formatCurrency(totalPtoPay)}</TableCell>
                <TableCell className="text-lg">
                  {formatCurrency(totalGrossPay)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
