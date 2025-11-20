import { useState } from "react";
import { format, isEqual } from "date-fns";
import {
  Dialog,
  DialogContentWithNoClose,
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
import { useAutoEndShift } from "@/hooks/useAutoEndShift";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "../ui/use-toast";

interface AutoShiftEndDialogProps {
  isOpen: boolean;
  onClose: () => void;
  timeEntryId: string;
  originalEndTime: Date;
  originalTeam: string;
  onSubmit?: () => void;
}

export const AutoShiftEndDialog = ({
  isOpen,
  onClose,
  timeEntryId,
  originalEndTime,
  originalTeam,
  onSubmit,
}: AutoShiftEndDialogProps) => {
  const [requestedEndTime, setRequestedEndTime] = useState(
    format(originalEndTime, "yyyy-MM-dd'T'HH:mm"),
  );
  const [reason, setReason] = useState("");
  const { createTimeCorrection, loading } = useTimeCorrections();
  const [team, setTeam] = useState<string>(originalTeam);
  const { autoEndShift } = useAutoEndShift();

  const handleConfirmation = async () => {
    const success = await autoEndShift(timeEntryId, originalEndTime);

    if (success) {
      setReason("");
      onClose();
      if (onSubmit) onSubmit();
    }
  };

  const handleTimeCorrection = async () => {
    if (!reason.trim() || !requestedEndTime) {
      toast({
        title: "Warning",
        description:
          "When submitted a different time than the shifts endtime you must give a reason",
      });
      return;
    }
    handleConfirmation();

    const success = await createTimeCorrection(
      timeEntryId,
      null,
      new Date(requestedEndTime).toISOString(),
      reason,
      team,
    );

    if (success) {
      setReason("");
      onClose();
      if (onSubmit) onSubmit();
    }
  };

  const handleSubmit = async () => {
    if (isEqual(new Date(requestedEndTime), originalEndTime)) {
      handleConfirmation();
    } else {
      handleTimeCorrection();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContentWithNoClose className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Automatically Ended</DialogTitle>
          <DialogDescription>
            Your shift was automatically ended at{" "}
            {format(originalEndTime, "h:mm a")}. If you were still working,
            please request a time correction below otherwise please confirm the
            time is correct
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="requested-time">Actual End Time</Label>
            <Input
              id="requested-time"
              type="datetime-local"
              value={requestedEndTime}
              onChange={(e) => setRequestedEndTime(e.target.value)}
              min={format(originalEndTime, "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          <Label htmlFor="request-type">Actual Team</Label>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bisongreen">Bison Green</SelectItem>
              <SelectItem value="boost">Boost</SelectItem>
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
          <Button onClick={handleSubmit}>Confirm</Button>
        </DialogFooter>
      </DialogContentWithNoClose>
    </Dialog>
  );
};
