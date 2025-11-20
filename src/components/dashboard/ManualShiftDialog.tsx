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
import { useProfile } from "@/hooks/useProfile";

interface ManualEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

export const ManualShiftDialog = ({
  isOpen,
  onClose,
  onSubmit,
}: ManualEntryDialogProps) => {
  const { profile, loading: profileLoading } = useProfile();

  const [requestedEndTime, setRequestedEndTime] = useState();
  const [requestedStartTime, setRequestedStartTime] = useState();

  const [reason, setReason] = useState("");
  const { createTimeCorrection, createManualTimeEntry, loading } =
    useTimeCorrections();
  const [requestedShiftType, setRequestedShiftType] =
    useState<string>("regular");

  const handleSubmit = async () => {
    if (!profile || !requestedStartTime || !requestedEndTime) return;

    const prefixedReason = "Manual Entry: ".concat(reason);
    const startTime = new Date(requestedStartTime).toISOString();
    const endTime = new Date(requestedEndTime).toISOString();

    // Need to create the time entry
    const data = await createManualTimeEntry(
      startTime,
      endTime,
      requestedShiftType,
      profile.team
    );
    let success = false;
    if (data) {
      // Create a time correction with no changes so that the manual entry gets reviewed
      success = await createTimeCorrection(
        data.id,
        startTime,
        endTime,
        prefixedReason,
        null,
        profile.team
      );
    }

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
          <DialogTitle>Manual Time Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="requested-time">Start Time</Label>
            <Input
              id="requested-start-time"
              type="datetime-local"
              value={requestedStartTime}
              onChange={(e) => setRequestedStartTime(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="requested-time">End Time</Label>
            <Input
              id="requested-end-time"
              type="datetime-local"
              value={requestedEndTime}
              onChange={(e) => setRequestedEndTime(e.target.value)}
            />
          </div>

          <Label htmlFor="request-type">Shift Type</Label>
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
            <Label htmlFor="reason">Reason for Manual Entry</Label>
            <Textarea
              id="reason"
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
            disabled={
              loading ||
              !requestedStartTime ||
              !requestedEndTime ||
              requestedEndTime < requestedStartTime
            }
          >
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
