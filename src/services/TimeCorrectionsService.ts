import { supabase } from "@/integrations/supabase/client";

export const TimeCorrectionsInsert = async (
  userId: string,
  timeEntryId: string,
  requestedStartTime: string,
  requestedEndTime: string,
  reason: string,
  team: string,
  requestedShiftType: string
) => {
  const { data, error } = await supabase
    .from("time_corrections")
    .insert([
      {
        user_id: userId,
        time_entry_id: timeEntryId,
        requested_start_time: requestedStartTime,
        requested_end_time: requestedEndTime,
        reason: reason,
        team: team,
        shift_type: requestedShiftType,
      },
    ])
    .select()
    .single();

  return { data, error };
};

export const TimeCorrectionsUpsert = async (
  id: string,
  userId: string,
  timeEntryId: string,
  requestedStartTime: string | null,
  requestedEndTime: string | null,
  reason: string,
  team: string | null,
  shiftType: string | null
) => {
  const { data, error } = await supabase
    .from("time_corrections")
    .update({
      user_id: userId,
      time_entry_id: timeEntryId,
      requested_end_time: requestedEndTime,
      requested_start_time: requestedStartTime,
      team: team,
      reason: reason,
      shift_type: shiftType,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("time_entry_id", timeEntryId)
    .select()
    .single();

  return { data, error };
};

export const TimeCorrectionSelectAllForAUser = async (userId) => {
  const { data: corrections, error } = await supabase.rpc(
    "get_all_time_corrections_user",
    { target_user_id: userId }
  );
  return { corrections, error };
};

export const TimeCorrectionSelectAllPendingCorrections = async () => {
  const { data: corrections, error: correctionsError } = await supabase.rpc(
    "get_time_corrections_all_pending"
  );

  return { corrections, correctionsError };
};
