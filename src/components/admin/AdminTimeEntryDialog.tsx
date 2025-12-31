import { useState, useEffect } from "react";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import {
  TimeEntriesInsertManualShift,
  TimeEntriesUpdate,
} from "@/services/TimeEntriesService";

export interface TimeEntryData {
  id?: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  status: string;
  team: string | null;
  shift_type: string | null;
}

interface AdminTimeEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  entry?: TimeEntryData | null;
  onSuccess: () => void;
}

const SHIFT_TYPES = [
  { value: "regular", label: "Regular Shift" },
  { value: "alternate", label: "Alternate Portfolio Shift" },
  { value: "training", label: "Training Shift" },
  { value: "bonus", label: "Bonus Shift" },
];

const TEAMS = [
  { value: "FIG", label: "FIG" },
  { value: "Pinnacle", label: "Pinnacle" },
  { value: "NAF", label: "NAF" },
  { value: "Carrington", label: "Carrington" },
  { value: "Training", label: "Training" },
];

export const AdminTimeEntryDialog = ({
  isOpen,
  onClose,
  userId,
  entry,
  onSuccess,
}: AdminTimeEntryDialogProps) => {
  const isEditing = !!entry?.id;
  const [loading, setLoading] = useState(false);

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [team, setTeam] = useState("FIG");
  const [shiftType, setShiftType] = useState("regular");
  const [status, setStatus] = useState("completed");

  useEffect(() => {
    if (entry) {
      setStartTime(format(new Date(entry.start_time), "yyyy-MM-dd'T'HH:mm"));
      setEndTime(
        entry.end_time
          ? format(new Date(entry.end_time), "yyyy-MM-dd'T'HH:mm")
          : ""
      );
      setTeam(entry.team || "FIG");
      setShiftType(entry.shift_type || "regular");
      setStatus(entry.status || "completed");
    } else {
      // Default for new entry - today with reasonable defaults
      const now = new Date();
      const defaultStart = new Date(now);
      defaultStart.setHours(9, 0, 0, 0);
      const defaultEnd = new Date(now);
      defaultEnd.setHours(17, 0, 0, 0);

      setStartTime(format(defaultStart, "yyyy-MM-dd'T'HH:mm"));
      setEndTime(format(defaultEnd, "yyyy-MM-dd'T'HH:mm"));
      setTeam("FIG");
      setShiftType("regular");
      setStatus("completed");
    }
  }, [entry, isOpen]);

  const calculateTotalHours = (): number => {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const totalMinutes = differenceInMinutes(end, start);
    return Math.round((totalMinutes / 60) * 100) / 100;
  };

  const handleSubmit = async () => {
    if (!startTime) {
      toast({
        title: "Error",
        description: "Start time is required",
        variant: "destructive",
      });
      return;
    }

    if (status === "completed" && !endTime) {
      toast({
        title: "Error",
        description: "End time is required for completed shifts",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const totalHours = calculateTotalHours();

      if (isEditing && entry?.id) {
        // Update existing entry
        const { error } = await TimeEntriesUpdate(entry.id, {
          start_time: new Date(startTime).toISOString(),
          end_time: endTime ? new Date(endTime).toISOString() : undefined,
          total_hours: totalHours,
          team,
          shift_type: shiftType,
          status,
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: "Time entry updated successfully",
        });
      } else {
        // Create new entry
        const { error } = await TimeEntriesInsertManualShift(
          new Date(startTime).toISOString(),
          new Date(endTime).toISOString(),
          totalHours,
          userId,
          team,
          shiftType
        );

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: "Time entry created successfully",
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving time entry:", error);
      toast({
        title: "Error",
        description: "Failed to save time entry",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const totalHours = calculateTotalHours();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Time Entry" : "Add Time Entry"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify this time entry's details."
              : "Create a new time entry for this employee."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              id="start-time"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="end-time">End Time</Label>
            <Input
              id="end-time"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              min={startTime}
            />
          </div>

          {totalHours > 0 && (
            <div className="text-sm text-gray-600">
              Total Hours: <span className="font-medium">{totalHours.toFixed(2)}</span>
            </div>
          )}

          <div>
            <Label htmlFor="team">Team</Label>
            <Select value={team} onValueChange={setTeam}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="shift-type">Shift Type</Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFT_TYPES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing && (
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="auto_ended">Auto Ended</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEditing ? "Update Entry" : "Create Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
