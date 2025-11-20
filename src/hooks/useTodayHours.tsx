import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { TimeEntriesSelectTodaysTotalHours } from "@/services/TimeEntriesService";

export const useTodayHours = () => {
  const [todayHours, setTodayHours] = useState(0);
  const { user } = useAuth();

  const fetchTodayHours = async () => {
    if (!user?.id) {
      console.log("No user ID available for fetchTodayHours");
      return;
    }

    console.log("Fetching today hours for user:", user.id);

    try {
      const today = new Date().toISOString().split("T")[0];
      console.log("Today date string:", today);

      const { data, error } = await TimeEntriesSelectTodaysTotalHours(
        user.id,
        today,
      );

      console.log("Today hours query result:", { data, error });

      if (error) {
        console.error("Error fetching today hours:", error);
      } else {
        const total = data.reduce(
          (sum, entry) => sum + (entry.total_hours || 0),
          0,
        );
        console.log("Calculated total hours for today:", total);
        setTodayHours(total);
      }
    } catch (error) {
      console.error("Unexpected error fetching today hours:", error);
    }
  };

  useEffect(() => {
    if (user) {
      console.log(
        "User authenticated, fetching today hours for user:",
        user.id,
      );
      fetchTodayHours();
    } else {
      console.log("No user authenticated");
      setTodayHours(0);
    }
  }, [user]);

  return {
    todayHours,
    fetchTodayHours,
  };
};
