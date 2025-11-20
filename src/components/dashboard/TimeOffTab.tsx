import { useAllTimeOffRequests } from "@/hooks/useAllTimeOffRequests";
import { TimeOffCalendar } from "../calendar/TimeOffCalendar";
import { TimeOffHistory } from "./TimeOffHistory";
import { useTimeOffRequests } from "@/hooks/useTimeOffRequests";
import { RequestTimeOff } from "@/types/RequestTimeOff";
import { TimeOffRequest } from "./TimeOffRequest";

export const TimeOffTab = () => {
  const { requests, refetch } = useAllTimeOffRequests();
  const { submitRequest } = useTimeOffRequests();

  const sumbitNewTimeOffRequest = async (requestData: RequestTimeOff) => {
    await submitRequest(requestData);
    await refetch();
  };
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <TimeOffRequest
          sumbitNewTimeOffRequest={(rd) => sumbitNewTimeOffRequest(rd)}
        />
        <div className="xl:row-span-2">
          <TimeOffCalendar className="sticky top-8" requests={requests} />
        </div>
      </div>
      <div className="mt-8">
        <TimeOffHistory />
      </div>
    </>
  );
};
