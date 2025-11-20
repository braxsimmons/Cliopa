import { supabase } from "@/integrations/supabase/client";

/**
 * Update the status and actual_clock_in time for the early attempt
 *
 * @param attemptId Id of attempt to update
 * @param status New status
 * @param actual_clock_in Time to set to
 * @returns error if there is any
 */
export const EarlyClockAttemptsUpdateStatus = async (
  attemptId: string,
  status: string,
  actual_clock_in: string | null
) => {
  const { error } = await supabase
    .from("early_clock_attempts")
    .update({
      status: status,
      actual_clock_in: actual_clock_in,
    })
    .eq("id", attemptId);

  return error;
};

/**
 * Creates an early clock in attempt
 *
 * @param userId Id of user who attempted to clock in
 * @param scheduledStart Time the are actually scheduled to start
 * @param team Team they are attempting to clock in under
 * @returns The created row along with any errors that may have occured
 */
export const EarlyClockAttemptsInsert = async (
  userId: string,
  scheduledStart: string,
  team: string,
  shift_type: string
) => {
  const { data, error } = await supabase
    .from("early_clock_attempts")
    .insert([
      {
        user_id: userId,
        scheduled_start: scheduledStart,
        status: "pending",
        team: team,
        shift_type: shift_type,
      },
    ])
    .select()
    .single();
  return { data, error };
};

/**
 * Gets all of the pending early clock in attempts for a give user
 *
 * @param userId Id of the user we want data about
 * @returns The pending clock in attempt data and any errors
 */
export const EarlyClockAttemptsSelectPendingAttempts = async (
  userId: string
) => {
  const { data, error } = await supabase
    .from("early_clock_attempts")
    .select(
      `id
      , actual_clock_in
      , attempted_time
      , created_at
      , scheduled_start
      , status
      , user_id
      , team
      , shift_type`
    )
    .eq("user_id", userId)
    .eq("status", "pending");

  return { data, error };
};

export const EarlyClockAttemptsSelectPendingAttemptsForAUserAndShift = async (
  userId: string,
  shiftStartTime
) => {
  const { data: earlyClockData, error: earlyClockError } = await supabase
    .from("early_clock_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("scheduled_start", shiftStartTime);

  return { earlyClockData, earlyClockError };
};
