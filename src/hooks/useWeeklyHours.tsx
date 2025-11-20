import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useUserRoles } from "./useUserRoles";
import {
  TimeEntriesUpdateVerifyShift,
  WeeklyHoursByDay,
} from "@/services/TimeEntriesService";
import { toast } from "./use-toast";

export type WeeklyHoursEntry = {
  week_start_date: string;
  monday_hours: number;
  tuesday_hours: number;
  wednesday_hours: number;
  thursday_hours: number;
  friday_hours: number;
  total_week_hours: number;
  all_verified: boolean;
  verified_ids: string[];
  unverified_ids: string[];
  has_pending_entries: boolean;
};

/**
 * Returns shift entries.
 * For shifts, also merge in correction info to surface front-end status.
 */
export const useWeeklyHours = (limit = 10) => {
  const [entries, setEntries] = useState<WeeklyHoursEntry[]>([]);
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
      const { weeklyHoursData, weeklyHoursError } = await WeeklyHoursByDay(
        user.id
      );
      if (weeklyHoursError) {
        console.error("Error fetching time entries:", weeklyHoursError);
      }

      setEntries(weeklyHoursData);
    } catch (err) {
      console.error("Unexpected error fetching time entries and PTO:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const VerifyWeeklyHours = async (unverified_ids: string[]) => {
    let hadError = false;
    for (const id of unverified_ids) {
      const { data, error } = await TimeEntriesUpdateVerifyShift(id);
      if (error) {
        hadError = true;
      }
    }

    if (hadError === true) {
      toast({
        title: "Error",
        description: `Failed to approve some shift`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Approved",
        description: `Successfully marked all pending shifts as approved`,
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

  return {
    entries,
    loading,
    refetch: fetchEntries,
    VerifyWeeklyHours,
  };
};
