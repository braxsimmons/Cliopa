import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  DollarSign,
  Download,
  FileSpreadsheet,
  Clock,
  Users,
  Calculator,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { PayrollService, PayrollEntry, getPayPeriods, PayPeriod } from '@/services/PayrollService';
import { cn } from '@/lib/utils';

export const PayrollExport = () => {
  const { toast } = useToast();
  const [payPeriods] = useState<PayPeriod[]>(getPayPeriods());
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (payPeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(`${payPeriods[0].start}|${payPeriods[0].end}`);
    }
  }, [payPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchPayrollData();
    }
  }, [selectedPeriod]);

  const fetchPayrollData = async () => {
    const [start, end] = selectedPeriod.split('|');
    if (!start || !end) return;

    setLoading(true);
    try {
      const data = await PayrollService.getPayrollBasic(start, end);
      setPayrollData(data.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (error) {
      console.error('Error fetching payroll:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payroll data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCurrentPeriod = (): PayPeriod | undefined => {
    const [start, end] = selectedPeriod.split('|');
    return payPeriods.find(p => p.start === start && p.end === end);
  };

  const downloadCSV = (type: 'adp' | 'detailed') => {
    const period = getCurrentPeriod();
    if (!period || payrollData.length === 0) return;

    const csv = type === 'adp'
      ? PayrollService.exportToADP(payrollData, period)
      : PayrollService.exportDetailed(payrollData, period);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll_${type}_${period.start}_${period.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Downloaded',
      description: `${type === 'adp' ? 'ADP' : 'Detailed'} payroll report exported`,
    });
  };

  // Calculate totals
  const totals = payrollData.reduce((acc, entry) => ({
    employees: acc.employees + 1,
    totalHours: acc.totalHours + entry.pp_total_hours,
    regularHours: acc.regularHours + entry.regular_rate_hours,
    otHours: acc.otHours + entry.total_ot_this_pay_period,
    regularPay: acc.regularPay + entry.regular_pay,
    otPay: acc.otPay + entry.overtime_pay,
    totalPay: acc.totalPay + entry.total_pay,
  }), { employees: 0, totalHours: 0, regularHours: 0, otHours: 0, regularPay: 0, otPay: 0, totalPay: 0 });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Payroll Export</h1>
          <p className="text-[var(--color-subtext)]">Generate payroll reports for processing</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[280px] bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
              <SelectValue placeholder="Select pay period" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
              {payPeriods.map((period, idx) => (
                <SelectItem key={idx} value={`${period.start}|${period.end}`}>
                  {period.label} {idx === 0 && '(Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchPayrollData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[var(--color-subtext)] mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Employees</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{totals.employees}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[var(--color-subtext)] mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Total Hours</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)]">{totals.totalHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-500 mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">OT Hours</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{totals.otHours.toFixed(1)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Total Payroll</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.totalPay)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--color-text)]">Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => downloadCSV('adp')}
              disabled={loading || payrollData.length === 0}
              className="bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export ADP Format
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadCSV('detailed')}
              disabled={loading || payrollData.length === 0}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Detailed Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Table */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--color-text)]">
            Payroll Details - {getCurrentPeriod()?.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : payrollData.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="h-12 w-12 mx-auto text-[var(--color-subtext)] mb-3" />
              <p className="text-[var(--color-subtext)]">No payroll data for this period</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left p-3 text-[var(--color-text)] font-medium">Employee</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">Total Hrs</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">Reg Hrs</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">OT Hrs</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">Reg Pay</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">OT Pay</th>
                    <th className="text-right p-3 text-[var(--color-text)] font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map((entry, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-xs font-medium">
                            {entry.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--color-text)]">{entry.full_name}</p>
                            <p className="text-xs text-[var(--color-subtext)]">{entry.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right text-[var(--color-text)]">
                        {entry.pp_total_hours.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-[var(--color-text)]">
                        {entry.regular_rate_hours.toFixed(2)}
                      </td>
                      <td className="p-3 text-right">
                        {entry.total_ot_this_pay_period > 0 ? (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {entry.total_ot_this_pay_period.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-[var(--color-subtext)]">0.00</span>
                        )}
                      </td>
                      <td className="p-3 text-right text-[var(--color-text)]">
                        {formatCurrency(entry.regular_pay)}
                      </td>
                      <td className="p-3 text-right text-orange-500">
                        {entry.overtime_pay > 0 ? formatCurrency(entry.overtime_pay) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600">
                        {formatCurrency(entry.total_pay)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[var(--color-bg)] font-medium">
                    <td className="p-3 text-[var(--color-text)]">TOTALS</td>
                    <td className="p-3 text-right text-[var(--color-text)]">{totals.totalHours.toFixed(2)}</td>
                    <td className="p-3 text-right text-[var(--color-text)]">{totals.regularHours.toFixed(2)}</td>
                    <td className="p-3 text-right text-orange-500">{totals.otHours.toFixed(2)}</td>
                    <td className="p-3 text-right text-[var(--color-text)]">{formatCurrency(totals.regularPay)}</td>
                    <td className="p-3 text-right text-orange-500">{formatCurrency(totals.otPay)}</td>
                    <td className="p-3 text-right text-green-600 text-lg">{formatCurrency(totals.totalPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
