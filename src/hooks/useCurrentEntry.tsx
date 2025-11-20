import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { TimeEntry } from "@/types/timeTracking";
import { TimeEntriesSelectActiveTimesForAUser } from "@/services/TimeEntriesService";

export const useCurrentEntry = () => {
  const [currentEntry, setCurrentEntry] = useState<TimeEntry | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCurrentEntry = async () => {
    if (!user?.id) {
      console.log("No user ID available for fetchCurrentEntry");
      return;
    }

    console.log("Fetching current entry for user:", user.id);

    try {
      const { data, error } = await TimeEntriesSelectActiveTimesForAUser(
        user.id,
      );

      if (error) {
        console.error("Error fetching current entry:", error);
        toast({
          title: "Database Error",
          description: `Unable to fetch current shift status: ${error.message}`,
          variant: "destructive",
        });
      } else {
        console.log("Successfully fetched current entry:", data);
        setCurrentEntry(data);
      }
    } catch (error) {
      console.error("Unexpected error fetching current entry:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching shift status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      console.log(
        "User authenticated, fetching current entry for user:",
        user.id,
      );
      fetchCurrentEntry();
    } else {
      console.log("No user authenticated");
      setCurrentEntry(null);
    }
  }, [user]);

  return {
    currentEntry,
    setCurrentEntry,
    fetchCurrentEntry,
  };
};
