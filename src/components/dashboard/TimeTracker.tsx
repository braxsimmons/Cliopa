import { Clock, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTimeTracking } from "@/hooks/useTimeTracking";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useAutoEndShift } from "@/hooks/useAutoEndShift";
import { AutoShiftEndDialog } from "./AutoShiftEndDialog";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { useProfile } from "@/hooks/useProfile";

export const TimeTracker = () => {
  const {
    currentEntry,
    todayHours,
    loading,
    startShift,
    endShift,
    isShiftActive,
    fetchCurrentEntry,
  } = useTimeTracking();
  const { user } = useAuth();
  const [currentShiftHours, setCurrentShiftHours] = useState(0);
  const [showTimeCorrectionDialog, setShowTimeCorrectionDialog] =
    useState<boolean>(false);
  const [autoEndDate, setAutoEndDate] = useState<Date>();
  const { scheduleAutoEnd } = useAutoEndShift();
  const { profile, loading: profileLoading } = useProfile();
  const [team, setTeam] = useState<string>("");
  const [shift_type, setShiftType] = useState<string>("regular");

  // Set team from profile when loaded (must be in useEffect, not during render)
  useEffect(() => {
    if (team === "" && !profileLoading && profile?.team) {
      setTeam(profile.team);
    }
  }, [profile, profileLoading, team]);

  useEffect(() => {
    const runAsync = async () => {
      if (currentEntry?.start_time) {
        const endShift = await scheduleAutoEnd(currentEntry);
        if (endShift) {
          console.log(currentEntry.id);
          setShowTimeCorrectionDialog(true);
          setAutoEndDate(endShift);
        }
      }
    };

    runAsync();
  }, [currentEntry]);

  useEffect(() => {
    const intervalRef = {
      current: null as ReturnType<typeof setInterval> | null,
    };

    if (currentEntry?.start_time) {
      const start = new Date(currentEntry.start_time);

      intervalRef.current = setInterval(() => {
        const now = new Date();
        const hours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
        setCurrentShiftHours(hours);
      }, 1000);
    } else {
      setCurrentShiftHours(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [currentEntry]);

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    const s = Math.floor(((hours - h) * 60 - m) * 60);
    return `${h}h ${m}m ${s}s`;
  };

  const handleShiftToggle = () => {
    if (isShiftActive) {
      endShift();
    } else {
      startShift(team, shift_type);
    }
  };

  return (
    <>
      <Card className="w-full bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[var(--color-text)]">
            <Clock className="h-5 w-5" />
            Time Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Button
              onClick={handleShiftToggle}
              disabled={loading || !user}
              size="lg"
              className={`w-full h-16 text-lg font-semibold transition-all ${
                isShiftActive
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Loading...
                </span>
              ) : isShiftActive ? (
                <>
                  <Square className="mr-2 h-6 w-6" />
                  End Shift
                </>
              ) : (
                <>
                  <Play className="mr-2 h-6 w-6" />
                  Start Shift
                </>
              )}
            </Button>
            <div className="space-y-1.5">
              <Label htmlFor="shift-type" className="text-[var(--color-subtext)] text-sm">
                Shift Type
              </Label>
              <Select
                value={isShiftActive ? currentEntry.shift_type : shift_type}
                onValueChange={setShiftType}
                disabled={isShiftActive}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  <SelectItem value="regular">Regular Shift</SelectItem>
                  <SelectItem value="alternate">Alternate Portfolio Shift</SelectItem>
                  <SelectItem value="training">Training Shift</SelectItem>
                  <SelectItem value="bonus">Bonus Shift</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-2 p-3 rounded-lg bg-[var(--color-bg)]">
              <div className="text-sm text-[var(--color-subtext)]">Current Shift</div>
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {isShiftActive ? formatHours(currentShiftHours) : "0h 0m 0s"}
              </div>
            </div>
            <div className="space-y-2 p-3 rounded-lg bg-[var(--color-bg)]">
              <div className="text-sm text-[var(--color-subtext)]">Today's Total</div>
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {formatHours(
                  todayHours + (isShiftActive ? currentShiftHours : 0)
                )}
              </div>
            </div>
          </div>

          {isShiftActive && currentEntry && (
            <div className="text-center text-sm text-[var(--color-subtext)] bg-green-50 dark:bg-green-950/20 py-2 px-3 rounded-lg">
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Shift started at {new Date(currentEntry.start_time).toLocaleTimeString()}
              </span>
            </div>
          )}

          {!user && (
            <div className="text-center text-sm text-[var(--color-danger)] bg-red-50 dark:bg-red-950/20 py-2 px-3 rounded-lg">
              Please sign in to track time
            </div>
          )}
        </CardContent>
      </Card>

      {showTimeCorrectionDialog && (
        <AutoShiftEndDialog
          isOpen={showTimeCorrectionDialog}
          onClose={() => setShowTimeCorrectionDialog(false)}
          timeEntryId={currentEntry.id}
          originalEndTime={autoEndDate}
          originalTeam={team}
          onSubmit={() => {
            setShowTimeCorrectionDialog(false);
            setCurrentShiftHours(0);
            fetchCurrentEntry();
          }}
        />
      )}
    </>
  );
};
