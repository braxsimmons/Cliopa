import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { isSameDay, parseISO, eachDayOfInterval } from "date-fns";
import { TimeOffRequestWithProfile } from "@/hooks/useAllTimeOffRequests";
import { CalendarGrid } from "./CalendarGrid";
import { CalendarHeader } from "./CalendarHeader";
import { DateEventsList } from "./DateEventsList";
import { CalendarLegend } from "./CalendarLegend";

interface TimeOffCalendarProps {
  requests: TimeOffRequestWithProfile[];
  className?: string;
  onDateSelect?: (date: Date | undefined) => void;
  externalSelectedDate?: Date | undefined;
  externalSelectedTeam?: string;
}

interface TimeOffEvent {
  id: string;
  user_id: string;
  request_type: "PTO" | "UTO";
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "denied" | "exception";
  employee_name: string;
  team: string | null;
}

export const TimeOffCalendar = ({
  requests,
  className,
  onDateSelect,
  externalSelectedDate,
  externalSelectedTeam,
}: TimeOffCalendarProps) => {
  const [internalSelectedTeam, setInternalSelectedTeam] =
    useState<string>("all");
  const [internalSelectedDate, setInternalSelectedDate] = useState<
    Date | undefined
  >(new Date());

  // Use external date if provided, otherwise use internal state
  const selectedDate = externalSelectedDate ?? internalSelectedDate;

  // Use external team if provided, otherwise use internal state
  const selectedTeam = externalSelectedTeam ?? internalSelectedTeam;

  // Transform requests into calendar events
  const timeOffEvents: TimeOffEvent[] = requests
    .filter(
      (request) =>
        request.status === "approved" ||
        request.status === "pending" ||
        request.status === "exception",
    )
    .map((request) => ({
      id: request.id,
      user_id: request.user_id,
      request_type: request.request_type,
      start_date: request.start_date,
      end_date: request.end_date,
      status: request.status,
      employee_name:
        request.profiles?.first_name && request.profiles?.last_name
          ? `${request.profiles.first_name} ${request.profiles.last_name}`.trim()
          : request.profiles?.email || "Unknown",
      team: request.profiles?.team || null,
    }));

  // Get unique teams for filtering
  const teams = [
    ...new Set(timeOffEvents.map((event) => event.team).filter(Boolean)),
  ].sort();

  // Filter events by selected team
  const filteredEvents =
    selectedTeam === "all"
      ? timeOffEvents
      : timeOffEvents.filter((event) => event.team === selectedTeam);

  // Get events for selected date
  const selectedDateEvents = selectedDate
    ? filteredEvents.filter((event) => {
        const startDate = parseISO(event.start_date);
        const endDate = parseISO(event.end_date);

        const datesInRange = eachDayOfInterval({
          start: startDate,
          end: endDate,
        });
        return datesInRange.some((rangeDate) =>
          isSameDay(rangeDate, selectedDate),
        );
      })
    : [];

  const handleDateSelect = (date: Date | undefined) => {
    // Update internal state if no external date is provided
    if (externalSelectedDate === undefined) {
      setInternalSelectedDate(date);
    }
    // Call external handler if provided
    if (onDateSelect) {
      onDateSelect(date);
    }
  };

  const handleTeamChange = (team: string) => {
    // Only update internal state if no external team is provided
    if (externalSelectedTeam === undefined) {
      setInternalSelectedTeam(team);
    }
  };

  return (
    <Card className={className}>
      <CalendarHeader
        selectedTeam={selectedTeam}
        onTeamChange={handleTeamChange}
        teams={teams}
        hideTeamFilter={externalSelectedTeam !== undefined}
      />
      <CardContent className="space-y-6">
        <CalendarGrid
          events={filteredEvents}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
        <DateEventsList
          selectedDate={selectedDate}
          events={selectedDateEvents}
        />
        <CalendarLegend />
      </CardContent>
    </Card>
  );
};
