import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { TimeEntry } from "@/types/timeTracking";
import { EmployeeShiftsDay } from "@/services/EmplyeeShiftService";
import { TimeEntriesUpdateAutoEndUpdate } from "@/services/TimeEntriesService";

export const useAutoEndShift = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const scheduleAutoEnd = async (entry: TimeEntry) => {
    if (!user?.id) {
      console.log("No user ID available for auto-end scheduling");
      return;
    }
    try {
      const startTime = new Date(entry.start_time);
      const dayOfWeek = startTime.getDay();

      console.log("Fetching schedule for user:", user.id, "day:", dayOfWeek);

      const { schedule, scheduleError } = await EmployeeShiftsDay(
        user.id,
        dayOfWeek,
      );

      if (scheduleError) {
        console.error("Error fetching schedule:", scheduleError);
        return;
      }

      if (!schedule) {
        console.log("No schedule found for this day");
        return;
      }

      let hours = 0;
      let minutes = 0;
      const now = new Date();
      const entryStartTime = new Date(entry.start_time);

      const [afternoonStartHours, afternoonStartMinutes] = schedule.afternoon_start.split(":").map(Number);
      const afternoonStart = new Date(
        entryStartTime.getFullYear(),
        entryStartTime.getMonth(),
        entryStartTime.getDate(),
        afternoonStartHours,
        afternoonStartMinutes - 10,
        0
      );

      if (new Date(entry.start_time) < afternoonStart) {
        [hours, minutes] = schedule.morning_end.split(":").map(Number);
      } else {
        [hours, minutes] = schedule.afternoon_end.split(":").map(Number);
      }
      const scheduledEndDate = new Date(startTime);
      scheduledEndDate.setHours(hours, minutes, 0, 0);
      if (scheduledEndDate < now && entry) {
        return scheduledEndDate;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error scheduling auto end:", error);
    }
  };

  const autoEndShift = async (entryId: string, endTime: Date) => {
    if (!user?.id) {
      console.error("No user ID available for auto-end");
      return null;
    }

    try {
      console.log("Auto-ending shift:", entryId, "at", endTime.toISOString());

      // First, let's try to update the time entry directly instead of using RPC
      const totalHours =
        (endTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      const roundedHours = Math.round(totalHours * 100) / 100;

      const { data, error } = await TimeEntriesUpdateAutoEndUpdate(
        endTime,
        roundedHours,
        entryId,
        user.id,
      );

      if (error) {
        console.error("Error auto-ending shift:", error);

        // Fallback: try the RPC call with proper error handling
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "auto_end_shift",
          {
            user_id_param: user.id,
            time_entry_id_param: entryId,
          },
        );

        if (rpcError) {
          console.error("RPC error:", rpcError);
          throw rpcError;
        }

        console.log("RPC call successful:", rpcData);
      } else {
        console.log("Direct update successful:", data);
      }

      toast({
        title: "Shift Automatically Ended",
        description: "Your shift has been ended according to your schedule.",
      });

      return { entryId, endTime };
    } catch (error) {
      console.error("Error auto-ending shift:", error);
      toast({
        title: "Auto-End Error",
        description:
          "Failed to automatically end shift. Please end it manually.",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    scheduleAutoEnd,
    autoEndShift,
  };
};
