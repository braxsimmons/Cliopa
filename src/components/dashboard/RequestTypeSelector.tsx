import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface RequestTypeSelectorProps {
  requestType: "PTO" | "UTO";
  onRequestTypeChange: (value: "PTO" | "UTO") => void;
  eligibleForPTO: boolean;
}

export const RequestTypeSelector = ({
  requestType,
  onRequestTypeChange,
  eligibleForPTO,
}: RequestTypeSelectorProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="request-type">Request Type</Label>
      <Select value={requestType} onValueChange={onRequestTypeChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem disabled={!eligibleForPTO} value="PTO">
            PTO (Paid Time Off)
          </SelectItem>
          <SelectItem value="UTO">UTO (Unpaid Time Off)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
