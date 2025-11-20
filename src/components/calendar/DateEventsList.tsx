import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface TimeOffEvent {
  id: string;
  user_id: string;
  request_type: "PTO" | "UTO";
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "denied";
  employee_name: string;
  team: string | null;
}

interface DateEventsListProps {
  selectedDate: Date | undefined;
  events: TimeOffEvent[];
}

export const DateEventsList = ({
  selectedDate,
  events,
}: DateEventsListProps) => {
  return (
    <div className="border-t pt-6">
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-lg">
            {selectedDate
              ? format(selectedDate, "EEEE, MMMM d, yyyy")
              : "Select a date"}
          </h4>
          {selectedDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Users className="h-4 w-4" />
              <span>{events.length} people out</span>
            </div>
          )}
        </div>

        {events.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="space-y-1">
                  <div className="font-medium">{event.employee_name}</div>
                  {event.team && (
                    <div className="text-sm text-gray-600">
                      Team: {event.team}
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    {format(parseISO(event.start_date), "MMM d")} -{" "}
                    {format(parseISO(event.end_date), "MMM d")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant={
                      event.request_type === "PTO" ? "default" : "secondary"
                    }
                  >
                    {event.request_type}
                  </Badge>
                  <Badge
                    variant={
                      event.status === "approved" ? "default" : "secondary"
                    }
                    className={
                      event.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : ""
                    }
                  >
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : selectedDate ? (
          <div className="text-center py-8 text-gray-500">
            No one is out on this date
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Select a date to see who's out
          </div>
        )}
      </div>
    </div>
  );
};
