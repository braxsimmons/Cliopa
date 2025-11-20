import { supabase } from "@/integrations/supabase/client";

export const PayrollCalculationsSelectAllColumns = async (
    payPeriodId?: string,
) => {
    let query = supabase
        .from("payroll_calculations")
        .select(
            "created_at, holiday_hours, holiday_pay, hourly_rate, id, overtime_hours, overtime_pay, pay_period_id, pto_hours, pto_pay, regular_hours, regular_pay, total_gross_pay, updated_at, user_id",
        )
        .order("total_gross_pay", { ascending: false });

    if (payPeriodId) {
        query = query.eq("pay_period_id", payPeriodId);
    }

    const { data: payrollData, error: payrollError } = await query;

    return { payrollData, payrollError };
};
