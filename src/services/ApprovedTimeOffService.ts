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

/**
 * Fetches all approved time off for a specific user
 */
export const ApprovedTimeOffSelectForUser = async (userId: string) => {
    const { data, error } = await supabase
        .from("approved_time_off")
        .select(`
            id,
            user_id,
            request_id,
            start_date,
            end_date,
            days_taken,
            request_type,
            hourly_rate,
            total_pay,
            created_at,
            time_off_requests (
                id,
                reason,
                status
            )
        `)
        .eq("user_id", userId)
        .order("start_date", { ascending: false });

    return { data, error };
};

/**
 * Admin creates approved time off directly (bypasses request flow)
 * Also creates an audit record in time_off_requests
 */
export const AdminCreateApprovedTimeOff = async (
    userId: string,
    data: {
        start_date: string;
        end_date: string;
        days_taken: number;
        request_type: "PTO" | "UTO";
        reason?: string;
    },
    approvedById: string
) => {
    // First, create the time_off_requests record for audit
    const { data: requestData, error: requestError } = await supabase
        .from("time_off_requests")
        .insert({
            user_id: userId,
            request_type: data.request_type,
            start_date: data.start_date,
            end_date: data.end_date,
            days_requested: data.days_taken,
            reason: data.reason || "Admin created",
            status: "approved",
            approved_by: approvedById,
            approved_at: new Date().toISOString(),
            approval_notes: "Created directly by admin",
        })
        .select()
        .single();

    if (requestError) {
        return { data: null, error: requestError };
    }

    // Then create the approved_time_off record linked to the request
    const { data: approvedData, error: approvedError } = await supabase
        .from("approved_time_off")
        .insert({
            user_id: userId,
            request_id: requestData.id,
            start_date: data.start_date,
            end_date: data.end_date,
            days_taken: data.days_taken,
            request_type: data.request_type,
        })
        .select()
        .single();

    return { data: approvedData, error: approvedError };
};

/**
 * Admin updates approved time off
 */
export const AdminUpdateApprovedTimeOff = async (
    id: string,
    updates: {
        start_date?: string;
        end_date?: string;
        days_taken?: number;
        request_type?: "PTO" | "UTO";
    }
) => {
    const { data, error } = await supabase
        .from("approved_time_off")
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

    return { data, error };
};

/**
 * Admin deletes approved time off
 */
export const AdminDeleteApprovedTimeOff = async (id: string) => {
    // The cascade delete will handle the time_off_requests record
    const { error } = await supabase
        .from("approved_time_off")
        .delete()
        .eq("id", id);

    return { error };
};

/**
 * Fetches all approved time off within a date range (for scheduler view)
 * Returns time off entries with profile info
 */
export const ApprovedTimeOffSelectForRange = async (
    startDate: string,
    endDate: string
) => {
    const { data, error } = await supabase
        .from("approved_time_off")
        .select(`
            id,
            user_id,
            start_date,
            end_date,
            days_taken,
            request_type,
            time_off_requests (
                id,
                reason,
                status
            )
        `)
        .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)
        .order("start_date", { ascending: true });

    return { data, error };
};
