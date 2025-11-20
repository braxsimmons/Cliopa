import { RequestTimeOff } from "@/types/RequestTimeOff";
import { TimeOffRequestForm } from "./TimeOffRequestForm";

interface TimeOffRequestProps {
  sumbitNewTimeOffRequest: (requestData: RequestTimeOff) => void;
}

export const TimeOffRequest = ({
  sumbitNewTimeOffRequest,
}: TimeOffRequestProps) => {
  return (
    <div className="space-y-6">
      <TimeOffRequestForm sumbitNewTimeOffRequest={sumbitNewTimeOffRequest} />
    </div>
  );
};
