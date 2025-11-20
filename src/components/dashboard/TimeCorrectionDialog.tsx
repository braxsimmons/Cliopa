import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useTimeCorrections } from "@/hooks/useTimeCorrections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface TimeCorrectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  timeEntryId: string;
  originalEndTime: Date;
  originalShiftType: string;
  originalStartTime: Date;
  originalTeam: string;
  onSubmit?: () => void;
}

export const TimeCorrectionDialog = ({
  isOpen,
  onClose,
  timeEntryId,
  originalEndTime,
  originalStartTime,
  originalShiftType,
  originalTeam,
  onSubmit,
}: TimeCorrectionDialogProps) => {
  const [requestedEndTime, setRequestedEndTime] = useState(
    format(originalEndTime, "yyyy-MM-dd'T'HH:mm")
  );
  const [requestedStartTime, setRequestedStartTime] = useState(
    format(originalStartTime, "yyyy-MM-dd'T'HH:mm")
  );
  console.log(originalEndTime);

  const [reason, setReason] = useState("");
  const { createTimeCorrection, loading } = useTimeCorrections();
  const [requestedShiftType, setRequestedShiftType] =
    useState<string>(originalShiftType);

  const handleSubmit = async () => {
    if (!reason.trim() || !requestedEndTime) return;

    const startTime =
      requestedStartTime !== format(originalStartTime, "yyyy-MM-dd'T'HH:mm")
        ? new Date(requestedStartTime).toISOString()
        : null;
    const endTime =
      requestedEndTime !== format(originalEndTime, "yyyy-MM-dd'T'HH:mm")
        ? new Date(requestedEndTime).toISOString()
        : null;

    const success = await createTimeCorrection(
      timeEntryId,
      startTime,
      endTime,
      reason,
      requestedShiftType,
      originalTeam
    );

    if (success) {
      setReason("");
      onClose();
      if (onSubmit) onSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Time Correction</DialogTitle>
          <DialogDescription>
            Your shift was automatically ended at{" "}
            {format(originalEndTime, "h:mm a")}. If you were still on a call
            with a customer, please request a time correction below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="requested-time">Actual Start Time</Label>
            <Input
              id="requested-start-time"
              type="datetime-local"
              value={requestedStartTime}
              onChange={(e) => setRequestedStartTime(e.target.value)}
              max={format(originalEndTime, "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          <div>
            <Label htmlFor="requested-time">Actual End Time</Label>
            <Input
              id="requested-end-time"
              type="datetime-local"
              value={requestedEndTime}
              onChange={(e) => setRequestedEndTime(e.target.value)}
              min={format(requestedStartTime, "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          <Label htmlFor="request-type">Actual Shift Type</Label>
          <Select
            value={requestedShiftType}
            onValueChange={setRequestedShiftType}
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

          <div>
            <Label htmlFor="reason">Reason for Correction</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need this time correction (e.g., 'Was on a customer call that ran over')"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim() || !requestedEndTime}
          >
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
