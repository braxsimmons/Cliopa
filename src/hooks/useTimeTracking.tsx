import { useCurrentEntry } from "./useCurrentEntry";
import { useTodayHours } from "./useTodayHours";
import { useShiftOperations } from "./useShiftOperations";

export const useTimeTracking = () => {
  const { currentEntry, setCurrentEntry, fetchCurrentEntry } =
    useCurrentEntry();
  const { todayHours, fetchTodayHours } = useTodayHours();
  const {
    loading,
    startShift,
    endShift,
    showTimeCorrectionDialog,
    setShowTimeCorrectionDialog,
    autoEndedEntry,
  } = useShiftOperations(currentEntry, setCurrentEntry, fetchTodayHours);

  return {
    currentEntry,
    todayHours,
    loading,
    startShift,
    endShift,
    isShiftActive: !!currentEntry,
    showTimeCorrectionDialog,
    setShowTimeCorrectionDialog,
    autoEndedEntry,
    fetchCurrentEntry,
  };
};
