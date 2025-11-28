import { supabase } from '@/integrations/supabase/client';

export interface PayrollEntry {
  pay_period_start: string;
  pay_period_end: string;
  full_name: string;
  role: string;
  pay_period_hours: number;
  current_pay_period_ot: number;
  week_prior_overtime: number;
  regular_rate_hours: number;
  week_prior_total_hours: number;
  total_ot_this_pay_period: number;
  pp_total_hours: number;
  regular_pay: number;
  overtime_pay: number;
  total_pay: number;
  user_id?: string;
  hourly_rate?: number;
}

export interface PayPeriod {
  start: string;
  end: string;
  label: string;
}

// Get current and recent pay periods
export const getPayPeriods = (): PayPeriod[] => {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth();
  const year = today.getFullYear();

  const periods: PayPeriod[] = [];

  // Calculate current pay period
  let currentStart: Date;
  let currentEnd: Date;

  if (day >= 8 && day <= 23) {
    // Mid-month period (8th - 23rd)
    currentStart = new Date(year, month - 1, 24);
    currentEnd = new Date(year, month, 7);
  } else if (day >= 24) {
    // End-month period (24th - 7th next month)
    currentStart = new Date(year, month, 8);
    currentEnd = new Date(year, month, 23);
  } else {
    // Beginning of month (1st - 7th)
    currentStart = new Date(year, month - 1, 8);
    currentEnd = new Date(year, month - 1, 23);
  }

  // Add last 6 pay periods
  for (let i = 0; i < 6; i++) {
    const periodStart = new Date(currentStart);
    const periodEnd = new Date(currentEnd);

    periodStart.setMonth(periodStart.getMonth() - Math.floor(i / 2));
    periodEnd.setMonth(periodEnd.getMonth() - Math.floor(i / 2));

    if (i % 2 === 1) {
      // Alternate between mid-month and end-month periods
      if (periodStart.getDate() === 8) {
        periodStart.setDate(24);
        periodStart.setMonth(periodStart.getMonth() - 1);
        periodEnd.setDate(7);
      } else {
        periodStart.setDate(8);
        periodEnd.setDate(23);
      }
    }

    periods.push({
      start: periodStart.toISOString().split('T')[0],
      end: periodEnd.toISOString().split('T')[0],
      label: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    });
  }

  return periods;
};

export const PayrollService = {
  // Get payroll data for a specific pay period using raw SQL
  async getPayrollForPeriod(startDate: string, endDate: string): Promise<PayrollEntry[]> {
    const { data, error } = await supabase.rpc('get_payroll_report', {
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) {
      console.error('Error fetching payroll:', error);
      // If the RPC doesn't exist, fall back to basic calculation
      return this.getPayrollBasic(startDate, endDate);
    }

    return data || [];
  },

  // Basic payroll calculation (fallback)
  async getPayrollBasic(startDate: string, endDate: string): Promise<PayrollEntry[]> {
    // Get all time entries in the period
    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select(`
        user_id,
        start_time,
        end_time,
        profiles:user_id (
          first_name,
          last_name,
          role,
          hourly_rate,
          email
        )
      `)
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${endDate}T23:59:59`)
      .not('end_time', 'is', null);

    if (entriesError) {
      console.error('Error fetching time entries:', entriesError);
      throw entriesError;
    }

    // Group by user and calculate hours
    const userHours: Record<string, {
      total: number;
      profile: any;
      weeklyHours: Record<string, number>;
    }> = {};

    (entries || []).forEach((entry: any) => {
      const userId = entry.user_id;
      if (!userHours[userId]) {
        userHours[userId] = {
          total: 0,
          profile: entry.profiles,
          weeklyHours: {},
        };
      }

      const start = new Date(entry.start_time);
      const end = new Date(entry.end_time);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      userHours[userId].total += hours;

      // Track weekly hours for OT calculation
      const weekStart = getWeekStart(start);
      const weekKey = weekStart.toISOString().split('T')[0];
      userHours[userId].weeklyHours[weekKey] = (userHours[userId].weeklyHours[weekKey] || 0) + hours;
    });

    // Calculate payroll for each user
    return Object.entries(userHours).map(([userId, data]) => {
      const hourlyRate = data.profile?.hourly_rate || 25;

      // Calculate overtime
      let totalOT = 0;
      Object.values(data.weeklyHours).forEach(weekHours => {
        if (weekHours > 40) {
          totalOT += weekHours - 40;
        }
      });

      const regularHours = Math.max(0, data.total - totalOT);
      const regularPay = regularHours * hourlyRate;
      const overtimePay = totalOT * hourlyRate * 1.5;

      return {
        pay_period_start: startDate,
        pay_period_end: endDate,
        full_name: data.profile?.first_name && data.profile?.last_name
          ? `${data.profile.first_name} ${data.profile.last_name}`
          : data.profile?.email || 'Unknown',
        role: data.profile?.role || 'employee',
        pay_period_hours: Math.round(data.total * 100) / 100,
        current_pay_period_ot: Math.round(totalOT * 100) / 100,
        week_prior_overtime: 0,
        regular_rate_hours: Math.round(regularHours * 100) / 100,
        week_prior_total_hours: 0,
        total_ot_this_pay_period: Math.round(totalOT * 100) / 100,
        pp_total_hours: Math.round(data.total * 100) / 100,
        regular_pay: Math.round(regularPay * 100) / 100,
        overtime_pay: Math.round(overtimePay * 100) / 100,
        total_pay: Math.round((regularPay + overtimePay) * 100) / 100,
        user_id: userId,
        hourly_rate: hourlyRate,
      };
    });
  },

  // Export to ADP format CSV
  exportToADP(data: PayrollEntry[], payPeriod: PayPeriod): string {
    const headers = [
      'Employee Name',
      'Position',
      'Pay Period Start',
      'Pay Period End',
      'Regular Hours',
      'OT Hours',
      'Total Hours',
      'Regular Pay',
      'OT Pay',
      'Gross Pay',
    ];

    const rows = data.map(entry => [
      entry.full_name,
      entry.role,
      payPeriod.start,
      payPeriod.end,
      entry.regular_rate_hours.toFixed(2),
      entry.total_ot_this_pay_period.toFixed(2),
      entry.pp_total_hours.toFixed(2),
      entry.regular_pay.toFixed(2),
      entry.overtime_pay.toFixed(2),
      entry.total_pay.toFixed(2),
    ]);

    // Add totals row
    const totals = data.reduce((acc, entry) => ({
      regularHours: acc.regularHours + entry.regular_rate_hours,
      otHours: acc.otHours + entry.total_ot_this_pay_period,
      totalHours: acc.totalHours + entry.pp_total_hours,
      regularPay: acc.regularPay + entry.regular_pay,
      otPay: acc.otPay + entry.overtime_pay,
      totalPay: acc.totalPay + entry.total_pay,
    }), { regularHours: 0, otHours: 0, totalHours: 0, regularPay: 0, otPay: 0, totalPay: 0 });

    rows.push([
      'TOTALS',
      '',
      '',
      '',
      totals.regularHours.toFixed(2),
      totals.otHours.toFixed(2),
      totals.totalHours.toFixed(2),
      totals.regularPay.toFixed(2),
      totals.otPay.toFixed(2),
      totals.totalPay.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  },

  // Export detailed report
  exportDetailed(data: PayrollEntry[], payPeriod: PayPeriod): string {
    const headers = [
      'Employee Name',
      'Role',
      'Pay Period',
      'Total Hours Worked',
      'Regular Hours (Straight Time)',
      'Current Period OT',
      'Prior Week OT Carryover',
      'Total OT This Period',
      'Hourly Rate',
      'Regular Pay',
      'Overtime Pay (1.5x)',
      'Gross Pay',
    ];

    const rows = data.map(entry => [
      entry.full_name,
      entry.role,
      `${payPeriod.start} to ${payPeriod.end}`,
      entry.pp_total_hours.toFixed(2),
      entry.regular_rate_hours.toFixed(2),
      entry.current_pay_period_ot.toFixed(2),
      entry.week_prior_overtime.toFixed(2),
      entry.total_ot_this_pay_period.toFixed(2),
      (entry.hourly_rate || 25).toFixed(2),
      entry.regular_pay.toFixed(2),
      entry.overtime_pay.toFixed(2),
      entry.total_pay.toFixed(2),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}
