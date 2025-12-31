import { useState, useEffect } from "react";
import { format, differenceInBusinessDays, parseISO, addDays } from "date-fns";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AdminCreateApprovedTimeOff,
  AdminUpdateApprovedTimeOff,
} from "@/services/ApprovedTimeOffService";

export interface TimeOffData {
  id?: string;
  start_date: string;
  end_date: string;
  days_taken: number;
  request_type: "PTO" | "UTO";
  time_off_requests?: {
    reason?: string;
  } | null;
}

interface AdminTimeOffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  entry?: TimeOffData | null;
  onSuccess: () => void;
}

export const AdminTimeOffDialog = ({
  isOpen,
  onClose,
  userId,
  entry,
  onSuccess,
}: AdminTimeOffDialogProps) => {
  const { user } = useAuth();
  const isEditing = !!entry?.id;
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requestType, setRequestType] = useState<"PTO" | "UTO">("PTO");
  const [reason, setReason] = useState("");
  const [daysCalculated, setDaysCalculated] = useState(0);

  useEffect(() => {
    if (entry) {
      setStartDate(entry.start_date);
      setEndDate(entry.end_date);
      setRequestType(entry.request_type);
      setReason(entry.time_off_requests?.reason || "");
      setDaysCalculated(entry.days_taken);
    } else {
      // Default for new entry
      const tomorrow = addDays(new Date(), 1);
      setStartDate(format(tomorrow, "yyyy-MM-dd"));
      setEndDate(format(tomorrow, "yyyy-MM-dd"));
      setRequestType("PTO");
      setReason("");
      setDaysCalculated(1);
    }
  }, [entry, isOpen]);

  // Calculate business days when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      // Add 1 because differenceInBusinessDays is exclusive
      const days = differenceInBusinessDays(addDays(end, 1), start);
      setDaysCalculated(Math.max(0, days));
    }
  }, [startDate, endDate]);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Start and end dates are required",
        variant: "destructive",
      });
      return;
    }

    if (daysCalculated <= 0) {
      toast({
        title: "Error",
        description: "Invalid date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isEditing && entry?.id) {
        // Update existing entry
        const { error } = await AdminUpdateApprovedTimeOff(entry.id, {
          start_date: startDate,
          end_date: endDate,
          days_taken: daysCalculated,
          request_type: requestType,
        });

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: "Time off updated successfully",
        });
      } else {
        // Create new entry
        if (!user?.id) {
          throw new Error("No authenticated user");
        }

        const { error } = await AdminCreateApprovedTimeOff(
          userId,
          {
            start_date: startDate,
            end_date: endDate,
            days_taken: daysCalculated,
            request_type: requestType,
            reason,
          },
          user.id
        );

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: `${requestType} created successfully`,
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving time off:", error);
      toast({
        title: "Error",
        description: "Failed to save time off",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Time Off" : "Add Time Off"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modify this time off entry."
              : "Create approved time off for this employee."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="request-type">Type</Label>
            <Select
              value={requestType}
              onValueChange={(value) => setRequestType(value as "PTO" | "UTO")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PTO">PTO (Paid Time Off)</SelectItem>
                <SelectItem value="UTO">UTO (Unpaid Time Off)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            Business Days:{" "}
            <span className="font-medium">{daysCalculated}</span>
          </div>

          {!isEditing && (
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for time off"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Saving..."
              : isEditing
              ? "Update Time Off"
              : "Create Time Off"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
