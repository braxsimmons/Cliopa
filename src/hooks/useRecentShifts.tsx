import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useUserRoles } from "./useUserRoles";
import {
  TimeEntriesSelectAllWithCompleteStatus,
  TimeEntriesUpdateVerifyShift,
} from "@/services/TimeEntriesService";
import { ApprovedTimeOffSelectLessThanEndDate } from "@/services/ApprovedTimeOffService";
import { toast } from "./use-toast";

export type RecentShiftEntry = {
  id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  request_type?: string; // "PTO" or "UTO"
  status?: string; // "auto_ended" | "completed" | etc, for shifts
  team: string;
  shift_type: string;
  time_corrections:
    | {
        status: "pending" | "approved" | "denied" | null;
      }[]
    | null;
  verified: string;
};

/**
 * Returns both shift and PTO entries.
 * For shifts, also merge in correction info to surface front-end status.
 * For PTO/UTO, returns status as "pto" for now (front-end can map this to display).
 */
export const useRecentShifts = (limit = 10) => {
  const [entries, setEntries] = useState<RecentShiftEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const {
    userRoles,
    canManageAllTimeEntries,
    loading: rolesLoading,
  } = useUserRoles();

  const fetchEntries = async () => {
    if (!user?.id || rolesLoading) {
      setLoading(false);
      setEntries([]);
      return;
    }

    try {
      // Fetch shifts
      const { shiftData, shiftError } =
        await TimeEntriesSelectAllWithCompleteStatus(limit, user.id);
      if (shiftError) {
        console.error("Error fetching time entries:", shiftError);
      }

      const shiftEntries: RecentShiftEntry[] = (shiftData ?? []).map(
        (entry) => ({
          ...entry,
          request_type: "shift",
        })
      );

      // Fetch PTO/UTO entries (from approved_time_off)
      const todayStr = new Date().toISOString().split("T")[0];

      const { ptoData, ptoError } = await ApprovedTimeOffSelectLessThanEndDate(
        todayStr,
        user.id
      );
      if (ptoError) {
        console.error("Error fetching PTO:", ptoError);
      }

      // PTO entries
      const ptoEntries: RecentShiftEntry[] = [];
      (ptoData || []).forEach((pto) => {
        const start = new Date(pto.start_date);
        const end = new Date(pto.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (!(d.getDay() === 0 || d.getDay() === 6)) {
            ptoEntries.push({
              id: `${pto.id}-${d.toISOString().split("T")[0]}`,
              start_time:
                new Date(d).setHours(9, 0, 0, 0) &&
                new Date(new Date(d).setHours(9, 0, 0, 0)).toISOString(),
              end_time:
                new Date(d).setHours(17, 0, 0, 0) &&
                new Date(new Date(d).setHours(17, 0, 0, 0)).toISOString(),
              total_hours: 8,
              request_type: pto.request_type,
              status: "pto", // for display
              shift_type: "pto",
              time_corrections: null,
              team: "",
              verified: "",
            });
          }
        }
      });

      // Combine and sort by start_time descending, limit to `limit` most recent overall
      const combined = [...shiftEntries, ...ptoEntries]
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        )
        .slice(0, limit);

      setEntries(combined);
    } catch (err) {
      console.error("Unexpected error fetching time entries and PTO:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const VerifyShift = async (id: string) => {
    const { data, error } = await TimeEntriesUpdateVerifyShift(id);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to approve shift: ${error.message}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved",
        description: `Successfully marked shift as approved`,
        variant: "default",
      });
      fetchEntries();
    }
  };

  useEffect(() => {
    if (user && !rolesLoading) {
      fetchEntries();
    } else {
      setEntries([]);
      setLoading(false);
    }
  }, [user, userRoles, rolesLoading]);

  return { entries, loading, refetch: fetchEntries, VerifyShift };
};
