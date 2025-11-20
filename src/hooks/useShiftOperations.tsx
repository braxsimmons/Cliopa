import { useState, useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { useShiftControls } from "./useShiftControls";
import { useAutoEndShift } from "./useAutoEndShift";
import { TimeEntry } from "@/types/timeTracking";

export const useShiftOperations = (
  currentEntry: TimeEntry | null,
  setCurrentEntry: (entry: TimeEntry | null) => void,
  fetchTodayHours: () => void,
) => {
  const [showTimeCorrectionDialog, setShowTimeCorrectionDialog] =
    useState(false);
  const [autoEndedEntry, setAutoEndedEntry] = useState<{
    id: string;
    endTime: Date;
  } | null>(null);
  const lastScheduledRef = useRef<string | null>(null);
  const { user } = useAuth();
  const { scheduleAutoEnd } = useAutoEndShift();

  // Handle auto-ended shifts
  const handleAutoEndedShift = (entryId: string, endTime: Date) => {
    console.log("Handling auto-ended shift:", entryId, endTime);
    setCurrentEntry(null);
    setAutoEndedEntry({ id: entryId, endTime });
    setShowTimeCorrectionDialog(true);
    fetchTodayHours();
  };

  const { loading, startShift, endShift } = useShiftControls(
    currentEntry,
    setCurrentEntry,
    fetchTodayHours,
    handleAutoEndedShift,
  );

  useEffect(() => {
    if (currentEntry && user && lastScheduledRef.current !== currentEntry.id) {
      lastScheduledRef.current = currentEntry.id;
      scheduleAutoEnd(currentEntry);
    }
  }, [currentEntry, user]);

  return {
    loading,
    startShift,
    endShift,
    showTimeCorrectionDialog,
    setShowTimeCorrectionDialog,
    autoEndedEntry,
    handleAutoEndedShift,
  };
};
