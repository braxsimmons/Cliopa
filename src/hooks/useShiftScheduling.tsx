import { useAuth } from "./useAuth";
import { EmployeeShiftsDay } from "@/services/EmplyeeShiftService";
import { subMinutes } from "date-fns";

export const useShiftScheduling = () => {
  const { user } = useAuth();

  /**
   * Checks if a user can clock in.
   *
   * We want to only let a user clock in if they are within a shift period and not before 5 minutes before
   * their shift is supposed to start.
   *
   * @returns if they can clock in and the earliest they can clock in
   */
  const checkShiftSchedule = async (): Promise<{
    canClockIn: boolean;
    scheduledStart?: Date;
  }> => {
    if (!user?.id) return { canClockIn: false };

    try {
      const now = new Date();
      const dayOfWeek = now.getDay();

      const { schedule, scheduleError } = await EmployeeShiftsDay(
        user.id,
        dayOfWeek,
      );

      // Don't allow clock in if there was an error or if the user doesn't have a shift
      if (
        scheduleError ||
        (!schedule?.morning_start && !schedule?.afternoon_start)
      ) {
        return { canClockIn: false };
      }

      //Convert shift times to Date for comparisons
      const convertedShift = {};
      if (schedule?.morning_start) {
        convertedShift["morning_start"] = convertShiftTimeToDate(
          schedule.morning_start,
        );
      }
      if (schedule?.morning_end) {
        convertedShift["morning_end"] = convertShiftTimeToDate(
          schedule.morning_end,
        );
      }
      if (schedule?.afternoon_start) {
        convertedShift["afternoon_start"] = convertShiftTimeToDate(
          schedule.afternoon_start,
        );
      }
      if (schedule?.afternoon_end) {
        convertedShift["afternoon_end"] = convertShiftTimeToDate(
          schedule.afternoon_end,
        );
      }

      // Find current shift if any
      const shift = checkCurrentShift(convertedShift, now);

      if (shift === null) {
        return { canClockIn: false };
      }

      const earliestClockIn = subMinutes(shift.shiftStart, 5);
      if (now < earliestClockIn) {
        return { canClockIn: false, scheduledStart: earliestClockIn };
      } else {
        return { canClockIn: true, scheduledStart: earliestClockIn };
      }
    } catch (error) {
      console.error("Error checking shift schedule:", error);
      return { canClockIn: false };
    }
  };

  /**
   * Determine if we are in a valid shift and if so when the start and end time will be.
   *
   * @param schedule the start and end times for a users shifts
   * @param currentTime Time the clock in was requested at
   * @returns The start and end times of the current shift or null if there is no shift to clock into.
   */
  const checkCurrentShift = (
    schedule: {
      morning_start: Date;
      morning_end: Date;
      afternoon_start: Date;
      afternoon_end: Date;
    },
    currentTime: Date,
  ): { shiftStart: Date; shiftEnd: Date } | null => {
    // Only have a morning shift
    if (schedule.morning_start && !schedule.afternoon_start) {
      // We are before the end of the shift and can clock in
      if (currentTime < schedule.morning_end) {
        return {
          shiftStart: schedule.morning_start,
          shiftEnd: schedule.morning_end,
        };
      }
      // We are after the end of the shift and shouldn't clock in
      return null;
    }

    // Only have an afternoon shift
    else if (!schedule.morning_start && schedule.afternoon_start) {
      // We are before the end of the shift and can clock in
      if (currentTime < schedule.afternoon_end) {
        return {
          shiftStart: schedule.afternoon_start,
          shiftEnd: schedule.afternoon_end,
        };
      }
      // We are after the end of the shift and shouldn't clock in
      return null;
    }

    // We have both shifts
    else {
      // if we are before morning end
      if (currentTime < schedule.morning_end) {
        return {
          shiftStart: schedule.morning_start,
          shiftEnd: schedule.morning_end,
        };
      }
      // before afternoon end but after morning end
      else if (
        currentTime > schedule.morning_end &&
        currentTime < schedule.afternoon_end
      ) {
        return {
          shiftStart: schedule.afternoon_start,
          shiftEnd: schedule.afternoon_end,
        };
      }

      //after all shifts
      return null;
    }
  };

  /**
   * Converts a time string to a date today with that time.
   *
   * @param shiftTime Time to convert
   * @returns new date with correct hours and minutes
   */
  const convertShiftTimeToDate = (shiftTime: string): Date => {
    const [hours, minutes] = shiftTime.split(":").map(Number);
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0,
    );
  };

  return {
    checkShiftSchedule,
  };
};
