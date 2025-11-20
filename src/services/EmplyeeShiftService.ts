import { supabase } from "@/integrations/supabase/client";

export const EmployeeShiftsSelectShiftTimes = async (userId: string) => {
    const { data: shiftsData, error: shiftsError } = await supabase
        .from("employee_shifts")
        .select(
            "day_of_week, morning_start, morning_end, afternoon_start, afternoon_end, is_working_day",
        )
        .eq("user_id", userId)
        .order("day_of_week");
    if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
    }

    return shiftsData;
};

export const EmployeeShiftsDelete = async (userId: string) => {
    const { error: deleteError } = await supabase
        .from("employee_shifts")
        .delete()
        .eq("user_id", userId);

    return deleteError;
};

export const EmployeeShiftsInsert = async (shiftsToInsert) => {
    const { error: shiftError } = await supabase
        .from("employee_shifts")
        .insert(shiftsToInsert);

    return shiftError;
};

export const EmployeeShiftsDay = async (userId: string, dayOfWeek: number) => {
    const { data: schedule, error: scheduleError } = await supabase
        .from("employee_shifts")
        .select("morning_start, morning_end, afternoon_start, afternoon_end")
        .eq("user_id", userId)
        .eq("day_of_week", dayOfWeek)
        .single();

    return { schedule, scheduleError };
};
