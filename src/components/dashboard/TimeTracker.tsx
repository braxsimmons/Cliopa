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

  if (team === "" && profileLoading === false && profile) {
    setTeam(profile.team);
  }

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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Button
              onClick={handleShiftToggle}
              disabled={loading || !user}
              size="lg"
              className={`w-full h-16 text-lg font-semibold ${
                isShiftActive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {loading ? (
                "Loading..."
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
            <Label htmlFor="request-type">Select Your Shift Type</Label>
            <Select
              value={isShiftActive ? currentEntry.shift_type : shift_type}
              onValueChange={setShiftType}
              disabled={isShiftActive}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular Shift</SelectItem>
                <SelectItem value="alternate">
                  Alternate Portfolio Shift
                </SelectItem>
                <SelectItem value="training">Training Shift</SelectItem>
                <SelectItem value="bonus">Bonus Shift</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Current Shift</div>
              <div className="text-2xl font-bold">
                {isShiftActive ? formatHours(currentShiftHours) : "0h 0m 0s"}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Today's Total</div>
              <div className="text-2xl font-bold">
                {formatHours(
                  todayHours + (isShiftActive ? currentShiftHours : 0)
                )}
              </div>
            </div>
          </div>

          {isShiftActive && currentEntry && (
            <div className="text-center text-sm text-gray-600">
              Shift started at{" "}
              {new Date(currentEntry.start_time).toLocaleTimeString()}
            </div>
          )}

          {!user && (
            <div className="text-center text-sm text-red-600">
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
