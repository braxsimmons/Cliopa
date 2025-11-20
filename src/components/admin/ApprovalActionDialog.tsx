import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ApprovalActionDialogProps {
  action: "approve" | "deny";
  onConfirm: (notes?: string) => void;
  loading: boolean;
}

export const ApprovalActionDialog = ({
  action,
  onConfirm,
  loading,
}: ApprovalActionDialogProps) => {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined);
    setNotes("");
    setOpen(false);
  };

  const isApprove = action === "approve";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={loading}
          className={isApprove ? "bg-green-600 hover:bg-green-700" : ""}
          variant={isApprove ? "default" : "destructive"}
          size="sm"
        >
          {isApprove ? (
            <>
              <Check className="h-4 w-4 mr-1" />
              Approve
            </>
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Deny
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isApprove ? "Approve" : "Deny"} Time Off Request
          </DialogTitle>
          <DialogDescription>
            {isApprove
              ? "Are you sure you want to approve this time off request?"
              : "Are you sure you want to deny this time off request?"}{" "}
            You can optionally add a note that will be visible to the employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Add a note about this ${
              action === "approve" ? "approval" : "denial"
            }...`}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={isApprove ? "bg-green-600 hover:bg-green-700" : ""}
            variant={isApprove ? "default" : "destructive"}
          >
            {loading ? "Processing..." : isApprove ? "Approve" : "Deny"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
