import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  datesToDisable?: Date[];
}

export const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  datesToDisable,
}: DateRangePickerProps) => {
  const now = new Date();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Start Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !startDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              defaultMonth={startDate}
              onSelect={onStartDateChange}
              disabled={[
                { before: now },
                { after: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) },
                (date) => datesToDisable?.some((d) => isSameDay(d, date)),
              ]}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>End Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !endDate && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              defaultMonth={endDate ? endDate : startDate}
              disabled={[
                !startDate,
                { before: startDate || now },
                { after: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()) },
                (date) => datesToDisable?.some((d) => isSameDay(d, date)),
              ]}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

    </div>
  );
};
