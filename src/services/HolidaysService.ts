import { supabase } from "@/integrations/supabase/client";

export const HolidaysSelectAllColumns = async () => {
    const { data, error } = await supabase
        .from("holidays")
        .select(
            `
          created_at,
          holiday_date,
          holiday_name,
          id`,
        )
        .order("holiday_date", { ascending: false });

    return { data, error };
};

export const HolidaysInsert = async (holidaysToInsert) => {
    const { error } = await supabase.from("holidays").insert(holidaysToInsert);

    return error;
};

export const HolidaysDelete = async (holidayId: string) => {
    const { error } = await supabase
        .from("holidays")
        .delete()
        .eq("id", holidayId);

    return error;
};
