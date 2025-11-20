import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "./DateRangePicker";

interface ShiftReportCSVDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSumbit: (startTime: Date, endTime: Date) => void;
}

export const ShiftReportCSVDialog = ({
  isOpen,
  onClose,
  onSumbit,
}: ShiftReportCSVDialogProps) => {
  const [requestedEndTime, setRequestedEndTime] = useState<Date>();
  const [requestedStartTime, setRequestedStartTime] = useState<Date>();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Report CSV Download</DialogTitle>
          <DialogDescription>Enter time frame</DialogDescription>
        </DialogHeader>
        <DateRangePicker
          startDate={requestedStartTime}
          endDate={requestedEndTime}
          onStartDateChange={setRequestedStartTime}
          onEndDateChange={setRequestedEndTime}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSumbit(requestedStartTime, requestedEndTime);
            }}
          >
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
