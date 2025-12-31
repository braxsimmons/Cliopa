import { supabase } from "@/integrations/supabase/client";

// Threshold in minutes for auto-approval eligibility
const AUTO_APPROVE_THRESHOLD_MINUTES = 10;

/**
 * Calculate if a time correction is eligible for auto-approval
 * A correction is auto-approvable if both start and end time deltas are <= threshold
 */
const isAutoApprovable = (
  originalStartTime: string | null,
  originalEndTime: string | null,
  requestedStartTime: string,
  requestedEndTime: string
): boolean => {
  if (!originalStartTime || !originalEndTime) {
    return false;
  }

  try {
    const origStart = new Date(originalStartTime).getTime();
    const origEnd = new Date(originalEndTime).getTime();
    const reqStart = new Date(requestedStartTime).getTime();
    const reqEnd = new Date(requestedEndTime).getTime();

    const startDeltaMinutes = Math.abs(reqStart - origStart) / (1000 * 60);
    const endDeltaMinutes = Math.abs(reqEnd - origEnd) / (1000 * 60);

    return startDeltaMinutes <= AUTO_APPROVE_THRESHOLD_MINUTES &&
           endDeltaMinutes <= AUTO_APPROVE_THRESHOLD_MINUTES;
  } catch {
    return false;
  }
};

export const TimeCorrectionsInsert = async (
  userId: string,
  timeEntryId: string,
  requestedStartTime: string,
  requestedEndTime: string,
  reason: string,
  team: string,
  requestedShiftType: string,
  originalStartTime?: string | null,
  originalEndTime?: string | null
) => {
  // Calculate if this correction is eligible for auto-approval
  const autoApprovable = isAutoApprovable(
    originalStartTime || null,
    originalEndTime || null,
    requestedStartTime,
    requestedEndTime
  );

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
        auto_approvable: autoApprovable,
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

/**
 * Manually trigger auto-approval of small corrections
 * This approves all pending corrections that:
 * - Are flagged as auto_approvable (delta <= 10 min)
 * - Were submitted before today (to prevent same-day gaming)
 * Returns the number of corrections approved
 */
export const TriggerAutoApprovalJob = async (): Promise<{ count: number; error: any }> => {
  const { data, error } = await supabase.rpc("auto_approve_small_corrections");

  return { count: data || 0, error };
};
