import { useEffect, useState } from "react";
import {
  TimeEntriesSelectCompletedTimeEntries,
  TimeEntriesSelectCompletedTimeEntriesFiltered,
} from "@/services/TimeEntriesService";
import { TimeOffTakenSelectLessThanEndDate } from "@/services/ApprovedTimeOffService";
import { parseISO, format } from "date-fns";

export interface ShiftReportEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  user_id: string;
  entry_type: "shift" | "time_off_pto" | "time_off_uto";
  request_type?: string;
  team: string;
  shift_type: string;
  // We get the profile data for normal shifts this way
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  verified: string | null;
  profiles?: {
    //This is how Pto gets profile data
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export const useShiftReport = () => {
  const [shifts, setShifts] = useState<ShiftReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      // Fetch completed time entries only
      const { timeEntries, timeError } =
        await TimeEntriesSelectCompletedTimeEntries();

      if (timeError) {
        console.error("Error fetching time entries:", timeError);
        setShifts([]);
        return;
      }

      // Fetch time off that has been taken (end_date is in the past)
      const today = new Date().toISOString().split("T")[0];
      const { takenPTO: takenTimeOff, ptoError: timeOffError } =
        await TimeOffTakenSelectLessThanEndDate(today);

      if (timeOffError) {
        console.error("Error fetching taken Time Off:", timeOffError);
      }

      // Process completed time entries
      const shiftEntries: ShiftReportEntry[] = (timeEntries || []).map(
        (entry) => {
          return {
            ...entry,
            entry_type: "shift" as const,
          };
        }
      );

      // Process lapsed approved PTO entries
      const ptoEntries: ShiftReportEntry[] = (takenTimeOff || []).flatMap(
        (timeOff) => {
          const entries: ShiftReportEntry[] = [];

          // Create entries for each day of the PTO period
          const startDate = parseISO(timeOff.start_date);
          const endDate = parseISO(timeOff.end_date);

          for (
            let date = new Date(startDate);
            date <= endDate;
            date.setDate(date.getDate() + 1)
          ) {
            const dayStart = new Date(date);
            dayStart.setHours(9, 0, 0, 0); // Default to 9 AM start

            const dayEnd = new Date(date);
            dayEnd.setHours(17, 0, 0, 0); // Default to 5 PM end

            if (!(date.getDay() === 0 || date.getDay() === 6)) {
              entries.push({
                ...timeOff,
                start_time: format(dayStart, "yyyy-MM-dd hh:mm a"),
                end_time: format(dayEnd, "yyyy-MM-dd hh:mm a"),
                total_hours: timeOff.request_type === "PTO" ? 8 : 0, // PTO counts as 8 hours UTO counts as 0 Hours
                entry_type:
                  timeOff.request_type === "PTO"
                    ? "time_off_pto"
                    : ("time_off_uto" as const),
                profiles: timeOff.time_off_requests.profiles,
              });
            }
          }

          return entries;
        }
      );

      // Combine and sort all entries
      const allEntries = [...shiftEntries, ...ptoEntries].sort(
        (a, b) =>
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      setShifts(allEntries);
    } catch (err) {
      console.error("Unexpected error fetching shifts report:", err);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  return { shifts, loading, refetch: fetchShifts };
};
