import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "@/components/ui/use-toast";
import { RequestTypeSelector } from "./RequestTypeSelector";
import { DateRangePicker } from "./DateRangePicker";
import { RequestSummary } from "./RequestSummary";
import { RequestTimeOff } from "@/types/RequestTimeOff";
import { useTimeOffRequests } from "@/hooks/useTimeOffRequests";
import { eachDayOfInterval, parseISO, addDays, isAfter } from "date-fns";

interface TimeOffRequestFormProps {
  sumbitNewTimeOffRequest: (requestData: RequestTimeOff) => void;
}

/**
 * Form on the Agent Dashboard to create Time Off Requests
 */
export const TimeOffRequestForm = ({
  sumbitNewTimeOffRequest,
}: TimeOffRequestFormProps) => {
  const { profile, refetchProfile } = useProfile();
  const [requestType, setRequestType] = useState<"PTO" | "UTO">("PTO");
  const { requests, refetch, getBalance } = useTimeOffRequests();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasEnoughBalance, setHasEnoughBalance] = useState(false);
  const [timeOffBalance, setTimeOffBalance] = useState();

  useEffect(() => {
    const fetchData = async () => {
      if (requestType && startDate && endDate) {
        const balanceData = await getBalance(
          startDate,
          endDate,
          requestType === "PTO" ? profile.pto_id : profile.uto_id
        );
        setTimeOffBalance(balanceData);
        let numDaysRequested = 0;
        let enoughBalance = true;
        for (const period of balanceData) {
          numDaysRequested += period.days_requested_in_period;
          if (period.days_requested_in_period > period.current_available) {
            enoughBalance = false;
          }
        }
        if (requestType === "UTO" && numDaysRequested > 3) {
          enoughBalance = false;
        }
        setHasEnoughBalance(enoughBalance);
      }
    };
    fetchData();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, requestType]);

  /**
   * Calculates the number of days being requested skipping weekends.
   * TODO: we should make it so this handles holidays once we get holiday functionality fixed
   *
   * @returns the number of days being requested, 0 if missing startDate or endDate
   */
  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (start <= end) {
      const day = start.getDay();
      if (!(day === 0 || day === 6)) {
        // Checks if the day is not a weekend (sunday = 0 and saturday = 6)
        count++;
      }
      start.setDate(start.getDate() + 1); // Moves to the next day
    }

    return count;
  };

  const requestedDays = calculateDays();
  const ptoBalance = profile?.available_pto || 0;
  const utoBalance = profile?.available_uto || 0;

  const eligibleForPTO = isAfter(
    new Date(),
    addDays(new Date(profile?.start_date), 90)
  ); //EligibleForPTO after 90 days

  const currentBalance = requestType === "PTO" ? ptoBalance : utoBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    if (requestType === "PTO" && !eligibleForPTO) {
      toast({
        title: "Not Eligible for PTO",
        description:
          "You aren't eligible to take PTO until you've worked 90 days. Check your employee profile for eligibility and consider submitting a UTO request instead.",
        variant: "destructive",
      });
      return;
    }

    if (requestedDays > currentBalance) {
      toast({
        title: `Insufficient ${requestType} Balance`,
        description: `You requested ${requestedDays} days but only have ${currentBalance} ${requestType} days available`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await sumbitNewTimeOffRequest({
        request_type: requestType,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        days_requested: requestedDays,
        reason: reason.trim() || undefined,
      });
      refetchProfile();

      toast({
        title: "Success",
        description: `${requestType} request submitted successfully`,
      });

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setReason("");
      refetch();
    } catch (error) {
      console.error("Error submitting time off request:", error);
      toast({
        title: "Error",
        description: "Failed to submit time off request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDatesInRange = (start: string, end: string): Date[] => {
    return eachDayOfInterval({
      start: parseISO(start),
      end: parseISO(end),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Time Off Request</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RequestTypeSelector
            requestType={requestType}
            onRequestTypeChange={setRequestType}
            eligibleForPTO={ptoBalance > 0}
          />

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            datesToDisable={requests.flatMap((request) =>
              getDatesInRange(request.start_date, request.end_date)
            )}
          />

          {startDate && endDate && (
            <RequestSummary
              requestedDays={requestedDays}
              currentBalance={currentBalance}
              requestType={requestType}
              timeOffBalance={timeOffBalance}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for time off request..."
              rows={3}
            />
          </div>

          <Button
            type="submit"
            disabled={
              loading ||
              !startDate ||
              !endDate ||
              !hasEnoughBalance ||
              (requestType === "PTO" && !eligibleForPTO) ||
              endDate < startDate
            }
            className="w-full"
          >
            {loading ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
