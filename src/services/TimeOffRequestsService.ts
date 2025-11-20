import { supabase } from "@/integrations/supabase/client";

export const TimeOffRequestsSelectAllColumns = async () => {
    const { data: timeOffRequests, error: requestsError } = await supabase
        .from("time_off_requests")
        .select(
            `
          id,
          user_id,
          request_type,
          start_date,
          end_date,
          days_requested,
          reason,
          status,
          created_at,
          updated_at,
          approved_at,
          approved_by,
          profiles!time_off_requests_user_id_fkey (id, first_name, last_name, email, team)
          `,
        )
        .order("created_at", { ascending: false });
    return { timeOffRequests, requestsError };
};

export const TimeOffRequestsSelectAllColumnsPendingStatus = async () => {
    const { data: timeOffRequests, error: requestsError } = await supabase
        .from("time_off_requests")
        .select(
            `
          id,
          user_id,
          request_type,
          start_date,
          end_date,
          days_requested,
          reason,
          status,
          created_at,
          approval_notes,
          profiles!time_off_requests_user_id_fkey (first_name, last_name, email, team)
          `,
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    return { timeOffRequests, requestsError };
};

export const TimeOffRequestSelectAllForAUser = async (userId: string) => {
    const { data, error } = await supabase
        .from("time_off_requests")
        .select(
            `
          approval_notes,
          approved_at,
          approved_by,
          created_at,
          days_requested,
          end_date,
          id,
          reason,
          request_type,
          start_date,
          status,
          updated_at,
          user_id
      `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    return { data, error };
};

export const TimeOffRequestInsert = async (userId: string, requestData) => {
    const { error } = await supabase.from("time_off_requests").insert({
        user_id: userId,
        ...requestData,
        reason: requestData.reason || null,
        status: "pending",
    });

    return error;
};

export const TimeOffRequestsUpdateApprovalNotes = async (
    approvalNotes: string,
    requestId: string,
) => {
    const { error: updateError } = await supabase
        .from("time_off_requests")
        .update({
            approval_notes: approvalNotes || null,
        })
        .eq("id", requestId);

    return updateError;
};

export const TimeOffRequestDelete = async (requestId: string) => {
    const { error } = await supabase.rpc("delete_time_off_request", {
        request_id: requestId,
    });

    return error;
};

export const TimeOffRequestBalance = async (userId: string, startDate: Date, endDate: Date, timeOffId: string) => {
    const {data, error} = await supabase.rpc("get_time_off_data", {
        target_user_id: userId, requested_start_date: startDate.toDateString(), requested_end_date: endDate.toDateString(), rule_id: timeOffId
    });
    console.log(error)

    return data
}
