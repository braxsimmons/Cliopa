import { supabase } from "@/integrations/supabase/client";

export const PayPeriodsSelectAllColumns = async () => {
    const { data, error } = await supabase
        .from("pay_periods")
        .select(
            `
          created_at,
          end_date,
          id,
          period_type,
          start_date,
          status,
          updated_at`,
        )
        .order("start_date", { ascending: false });

    return { data, error };
};
