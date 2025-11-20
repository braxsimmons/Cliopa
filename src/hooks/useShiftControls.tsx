import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useEarlyClockIn } from "./useEarlyClockIn";
import { useShiftScheduling } from "./useShiftScheduling";
import { useAutoEndShift } from "./useAutoEndShift";
import { TimeEntry } from "@/types/timeTracking";
import {
  TimeEntriesInsert,
  TimeEntriesUpdateCompletedShift,
} from "@/services/TimeEntriesService";

export const useShiftControls = (
  currentEntry: TimeEntry | null,
  setCurrentEntry: (entry: TimeEntry | null) => void,
  fetchTodayHours: () => void,
  onAutoEnd?: (entryId: string, endTime: Date) => void
) => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { scheduleEarlyClockIn, processPendingAttempts } = useEarlyClockIn();
  const { checkShiftSchedule } = useShiftScheduling();
  const { scheduleAutoEnd } = useAutoEndShift();

  /**
   * Attempts to clock in user under their selected team.
   *
   * Checks if agent is already clocked in, if they are attempting to clock in early,
   * and scheduled to clock out at end of shift.
   *
   * @param team Team user is attempting to clock in under
   * @param shift_type What type of shift they are going to do
   */
  const startShift = async (team: string, shift_type: string) => {
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    if (currentEntry) {
      toast({
        title: "Shift Already Active",
        description: "You already have an active shift",
        variant: "destructive",
      });
      return;
    }
    const { canClockIn, scheduledStart } = await checkShiftSchedule();

    // Attempting to clock in Early
    if (!canClockIn && scheduledStart) {
      await scheduleEarlyClockIn(scheduledStart, team, shift_type, startShift);
      return;
    } else if (!canClockIn) {
      toast({
        title: "No Valid Shift",
        description: "Unable to find a valid shift to clock into",
        variant: "destructive",
      });
    } else {
      setLoading(true);

      // Handle Clocking In
      try {
        const startTime = new Date().toISOString();

        const { data, error } = await TimeEntriesInsert(
          user.id,
          startTime,
          team,
          shift_type
        );

        if (error) {
          console.error("Error starting shift:", error);
          toast({
            title: "Error",
            description: `Failed to start shift: ${error.message}`,
            variant: "destructive",
          });
        } else {
          console.log("Shift started successfully:", data);
          setCurrentEntry(data);
          toast({
            title: "Shift Started",
            description: "Your shift has been started successfully",
          });

          // Set up automatic shift ending
          console.log("Setting up auto-end for shift:", data.id);
          scheduleAutoEnd(data);
        }
      } catch (error) {
        console.error("Unexpected error starting shift:", error);
        toast({
          title: "Error",
          description: "Failed to start shift",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    processPendingAttempts(startShift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endShift = async () => {
    if (!user?.id || !currentEntry) {
      toast({
        title: "No Active Shift",
        description: "No active shift to end",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const endTime = new Date().toISOString();
      const totalHours =
        (new Date(endTime).getTime() -
          new Date(currentEntry.start_time).getTime()) /
        (1000 * 60 * 60);

      const roundedHours = Math.round(totalHours * 100) / 100;

      const { data, error } = await TimeEntriesUpdateCompletedShift(
        endTime,
        roundedHours,
        currentEntry.id,
        user.id
      );

      if (error) {
        console.error("Error ending shift:", error);
        toast({
          title: "Error",
          description: `Failed to end shift: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log("Shift ended successfully:", data);
        setCurrentEntry(null);
        fetchTodayHours();
        toast({
          title: "Shift Ended",
          description: "Your shift has been ended successfully",
        });
      }
    } catch (error) {
      console.error("Unexpected error ending shift:", error);
      toast({
        title: "Error",
        description: "Failed to end shift",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    startShift,
    endShift,
  };
};
