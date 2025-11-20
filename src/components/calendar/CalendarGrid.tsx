import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO, eachDayOfInterval } from "date-fns";
import { cn } from "@/lib/utils";

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

interface CalendarGridProps {
  events: TimeOffEvent[];
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
}

export const CalendarGrid = ({
  events,
  selectedDate,
  onDateSelect,
}: CalendarGridProps) => {
  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const startDate = parseISO(event.start_date);
      const endDate = parseISO(event.end_date);

      const datesInRange = eachDayOfInterval({
        start: startDate,
        end: endDate,
      });
      return datesInRange.some((rangeDate) => isSameDay(rangeDate, date));
    });
  };

  const handleDateClick = (date: Date | undefined) => {
    onDateSelect(date);
  };

  return (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleDateClick}
      className="rounded-md border w-full justify-items-center"
      components={{
        DayButton: ({ day, ...props }) => {
          const dayEvents = getEventsForDate(day.date);
          const isToday = isSameDay(day.date, new Date());
          const isSelected = selectedDate && isSameDay(day.date, selectedDate);

          return (
            <button
              {...props}
              onClick={() => handleDateClick(day.date)}
              className={cn(
                props.className,
                "relative w-16 h-full p-1 font-normal rounded-md cursor-pointer aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground",
                isToday &&
                  !isSelected &&
                  "bg-accent text-accent-foreground font-semibold",
              )}
              style={{ minHeight: "70px" }}
            >
              <div className="flex flex-col justify-start items-center h-full">
                <div>{format(day.date, "d")}</div>

                {dayEvents.length > 0 && (
                  <div className="flex flex-col items-center gap-[2px] leading-none">
                    <div className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                      {dayEvents.length}
                    </div>
                    <div className="text-[10px] text-gray-600 text-center leading-tight">
                      out
                    </div>
                  </div>
                )}
              </div>
            </button>
          );
        },
      }}
    />
  );
};
