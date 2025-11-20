import { supabase } from "@/integrations/supabase/client";

export const ApprovedTimeOffSelectPTOs = async (userId: string) => {
    const { data: approved, error: ptoError } = await supabase
        .from("approved_time_off")
        .select("start_date, end_date, days_taken, request_type")
        .eq("user_id", userId)
        .eq("request_type", "PTO");
    if (ptoError) {
        console.error("Error fetching approved PTO:", ptoError);
    }

    return approved;
};

export const ApprovedTimeOffSelectLessThanEndDate = async (
    todayStr: string,
    userId: string,
) => {
    const ptoQuery = supabase
        .from("approved_time_off")
        .select(
            `
          created_at,
          days_taken,
          end_date,
          hourly_rate,
          id,
          request_id,
          request_type,
          start_date,
          total_pay,
          updated_at,
          user_id
      `,
        )
        .lte("end_date", todayStr)
        .eq("user_id", userId)
        .order("start_date", { ascending: false });

    const { data: ptoData, error: ptoError } = await ptoQuery;
    return { ptoData, ptoError };
};

export const TimeOffTakenSelectLessThanEndDate = async (today: string) => {
    const { data: takenTimeOff, error: ptoError } = await supabase
        .from("approved_time_off")
        .select(
            `
        id
        , user_id
        , start_date
        , end_date
        , days_taken
        , request_type
        , time_off_requests(
            profiles!time_off_requests_user_id_fkey(
                first_name
                , last_name
                , email
        ))`)
    .lte("end_date", today)
    .order("start_date", { ascending: false });

    return { takenPTO: takenTimeOff, ptoError };
};
