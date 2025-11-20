import { supabase } from "@/integrations/supabase/client";

export const TimeEntriesUpdateAutoEndUpdate = async (
  endTime: Date,
  roundedHours: number,
  entryId: string,
  userId: string
) => {
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      end_time: endTime.toISOString(),
      total_hours: Math.abs(roundedHours), // Ensure positive value
      status: "auto_ended",
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select()
    .single();
  return { data, error };
};

export const TimeEntriesSelectActiveTimesForAUser = async (userId: string) => {
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id, start_time, end_time, total_hours, status, user_id, team, shift_type"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log("Current entry query result:", { data, error });
  return { data, error };
};

export const TimeEntriesSelectAllWithCompleteStatus = async (
  limit: number,
  userId: string
) => {
  const { data: shiftData, error: shiftError } = await supabase.rpc(
    "get_recent_shifts",
    { target_user_id: userId, num_shifts: limit }
  );
  return { shiftData, shiftError };
};

export const WeeklyHoursByDay = async (userId: string) => {
  const { data: weeklyHoursData, error: weeklyHoursError } = await supabase.rpc(
    "get_weekly_hours",
    { target_user_id: userId }
  );
  return { weeklyHoursData, weeklyHoursError };
};

/**
 * Creates record of the clock in
 *
 * @param userId Id of the user who clocked in
 * @param startTime Time they clocked in
 * @param team Team they clocked in under
 * @returns The new record and any errors
 */
export const TimeEntriesInsert = async (
  userId: string,
  startTime: string,
  team: string,
  shift_type: string
) => {
  const { data, error } = await supabase
    .from("time_entries")
    .insert([
      {
        user_id: userId,
        start_time: startTime,
        status: "active",
        team: team,
        shift_type: shift_type,
      },
    ])
    .select()
    .single();
  return { data, error };
};

export const TimeEntriesUpdateCompletedShift = async (
  endTime: string,
  roundedHours: number,
  currentEntryId: string,
  userId: string
) => {
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      end_time: endTime,
      total_hours: roundedHours,
      status: "completed",
    })
    .eq("id", currentEntryId)
    .eq("user_id", userId)
    .select()
    .single();
  return { data, error };
};

export const TimeEntriesInsertManualShift = async (
  startTime: string,
  endTime: string,
  roundedHours: number,
  userId: string,
  team: string,
  shift_type: string
) => {
  const { data, error } = await supabase
    .from("time_entries")
    .insert([
      {
        user_id: userId,
        start_time: startTime,
        end_time: endTime,
        status: "completed",
        team: team,
        total_hours: roundedHours,
        shift_type: shift_type,
      },
    ])
    .select()
    .single();
  return { data, error };
};

export const TimeEntriesSelectCompletedTimeEntries = async () => {
  const { data: timeEntries, error: timeError } = await supabase.rpc(
    "get_completed_time_entries"
  );

  return { timeEntries, timeError };
};

export const TimeEntriesSelectCompletedTimeEntriesFiltered = async (
  startTime: Date,
  endTime: Date
) => {
  const startTimeIso = startTime.toISOString();
  const endTimeIso = endTime.toISOString();

  const { data: timeEntries, error: timeError } = await supabase
    .rpc("get_completed_time_entries")
    .gte("start_time", startTimeIso)
    .lte("end_time", endTimeIso);

  return { timeEntries, timeError };
};

export const TimeEntriesSelectTodaysTotalHours = async (
  userId: string,
  today: string
) => {
  const { data, error } = await supabase
    .from("time_entries")
    .select("total_hours")
    .eq("user_id", userId)
    .in("status", ["completed", "auto_ended"])
    .gte("start_time", `${today}T00:00:00`)
    .lt("start_time", `${today}T23:59:59`);

  return { data, error };
};

export const TimeEntriesUpdateVerifyShift = async (id: string) => {
  const currentTime = new Date().toISOString();
  const { data, error } = await supabase
    .from("time_entries")
    .update({
      verified: currentTime,
    })
    .eq("id", id)
    .select()
    .single();

  return { data, error };
};
