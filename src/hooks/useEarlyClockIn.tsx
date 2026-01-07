import { useState } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import {
  EarlyClockAttemptsInsert,
  EarlyClockAttemptsSelectPendingAttempts,
  EarlyClockAttemptsSelectPendingAttemptsForAUserAndShift,
  EarlyClockAttemptsUpdateStatus,
} from "@/services/EarlyClockAttemptsService";

/**
 * Handles functionality related to attempting to clockin before scheduled time
 */
export const useEarlyClockIn = () => {
  const [pendingAttempts, setPendingAttempts] = useState<
    {
      id: string;
      actual_clock_in: string;
      attempted_time: string;
      created_at: string;
      scheduled_start: string;
      status: string;
      user_id: string;
      team: string;
      shift_type: string;
    }[]
  >([]);
  const { user } = useAuth();
  const { toast } = useToast();

  /**
   * Update the pending early clock in attempt and actually clock in the user.
   *
   * @param attemptId clock in attempt that needs to be created
   * @param team Team user is clocking in under
   * @param startShift Function to start the shift
   */
  const executeScheduledClockIn = async (
    attemptId: string,
    team: string,
    shift_type: string,
    startShift: (team: string, shift_type: string) => Promise<void> | void
  ) => {
    try {
      // Update the early clock in
      const error = await EarlyClockAttemptsUpdateStatus(
        attemptId,
        "completed",
        new Date().toISOString()
      );

      if (error) throw error;

      // Start the shift
      await startShift(team, shift_type);
    } catch (error) {
      console.error("Error executing scheduled clock-in:", error);

      try {
        // Something went wrong so mark the clock in attempt as cancelled
        const error = await EarlyClockAttemptsUpdateStatus(
          attemptId,
          "cancelled",
          null
        );
        if (error) throw error;
      } catch (error) {
        console.error("Error cancelling failed clock-in attempt:", error);
      }

      toast({
        title: "Early Clock-In Cancelled",
        description:
          "Scheduled clock-in failed. You may have been logged out and will need to start your shift manually.",
        variant: "destructive",
      });
    }
  };

  /**
   * Creates an early clock in attempt or schedules one to happen when within 5 minutes of clock in time.
   *
   * @param scheduledStart scheduled time user is allowed to clock in at
   * @param team team the user is clocking in for
   * @param startShift  function to startShift
   * @returns Data associated with the early_clock_attempt
   */
  const scheduleEarlyClockIn = async (
    scheduledStart: Date,
    team: string,
    shift_type: string,
    startShift: (team: string, shift_type: string) => Promise<void> | void
  ) => {
    if (!user?.id) return;

    // Insert the early clock in attempt
    try {
      const { earlyClockData, earlyClockError } =
        await EarlyClockAttemptsSelectPendingAttemptsForAUserAndShift(
          user.id,
          scheduledStart.toISOString()
        );

      if (earlyClockData.length <= 0) {
        const { data, error } = await EarlyClockAttemptsInsert(
          user.id,
          scheduledStart.toISOString(),
          team,
          shift_type
        );
        if (error) {
          throw error;
        }

        // Schedule a clockin at a time within the users allowed clockin time
        const timeUntilClockIn = scheduledStart.getTime() - Date.now();
        if (timeUntilClockIn > 0) {
          setTimeout(() => {
            executeScheduledClockIn(data.id, team, shift_type, startShift);
          }, timeUntilClockIn);
        } else {
          executeScheduledClockIn(data.id, team, shift_type, startShift);
        }
        toast({
          title: "Early Clock-In Scheduled",
          description:
            "Company policy states that employees may only clock in 10 minutes early. Your clock will start then. Thanks!",
          duration: 5000,
        });
        return data;
      } else {
        toast({
          title: "Already Scheduled Early Clock In",
          description:
            "You already have a scheduled early clock in for this shift.",
          duration: 5000,
        });
      }

      if (earlyClockError) {
        throw earlyClockError;
      }
    } catch (error) {
      console.error("Error scheduling early clock-in:", error);
      toast({
        title: "Error",
        description: "Failed to schedule early clock-in",
        variant: "destructive",
      });
    }
  };

  /**
   * Goes through each of the pending Early Clock In Attempts and starts the shift of the ready ones
   *
   * @param startShift function to start the shift
   */
  const processPendingAttempts = async (
    startShift: (team: string, shift_type: string) => Promise<void> | void
  ) => {
    if (!user?.id) return;

    try {
      const { data, error } = await EarlyClockAttemptsSelectPendingAttempts(
        user.id
      );

      if (error) throw error;

      setPendingAttempts(data);

      data.forEach((attempt) => {
        const scheduled = new Date(attempt.scheduled_start);
        const timeUntilClockIn = scheduled.getTime() - Date.now();

        if (timeUntilClockIn <= 0) {
          executeScheduledClockIn(
            attempt.id,
            attempt.team,
            attempt.shift_type,
            startShift
          );
        } else {
          setTimeout(() => {
            executeScheduledClockIn(
              attempt.id,
              attempt.team,
              attempt.shift_type,
              startShift
            );
          }, timeUntilClockIn);
        }
      });
    } catch (error) {
      console.error("Error processing pending clock-ins:", error);
    }
  };

  return {
    pendingAttempts,
    scheduleEarlyClockIn,
    processPendingAttempts,
  };
};
