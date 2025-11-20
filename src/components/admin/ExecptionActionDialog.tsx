import { useState } from "react";
import { Check, Minus, X } from "lucide-react";
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

interface ExceptionActionDialogProps {
  onConfirm: (notes?: string) => void;
  loading: boolean;
}

export const ExceptionActionDialog = ({
  onConfirm,
  loading,
}: ExceptionActionDialogProps) => {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm(notes.trim() || undefined);
    setNotes("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={loading}
          className="w-full"
          variant={"secondary"}
          size="sm"
        >
          <Minus />
          Exception
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Time Off Request Exception</DialogTitle>
          <DialogDescription>
            Are you sure you want to approve this time off request? You can
            optionally add a note that will be visible to the employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={`Add a note about this exception approval`}
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
            className={"bg-green-600 hover:bg-green-700"}
            variant={"default"}
          >
            {loading ? "Processing..." : "Exception Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
