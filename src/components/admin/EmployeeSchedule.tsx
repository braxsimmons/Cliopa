import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy } from "lucide-react";
import { ShiftData, DAYS_OF_WEEK } from "@/types/employee";

interface EmployeeScheduleProps {
  shifts: ShiftData[];
  editing: boolean;
  editShifts: ShiftData[];
  onShiftChange: (
    dayIndex: number,
    field: keyof ShiftData,
    value: boolean | string,
  ) => void;
}

export const EmployeeSchedule = ({
  shifts,
  editing,
  editShifts,
  onShiftChange,
}: EmployeeScheduleProps) => {
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showCopyMode, setShowCopyMode] = useState(false);

  const handleCopySchedule = () => {
    if (copyFromDay === null || selectedDays.length === 0) return;

    const sourceShift = editShifts[copyFromDay];
    selectedDays.forEach((dayIndex) => {
      onShiftChange(dayIndex, "is_working_day", sourceShift.is_working_day);
      onShiftChange(dayIndex, "morning_start", sourceShift.morning_start);
      onShiftChange(dayIndex, "morning_end", sourceShift.morning_end);
      onShiftChange(dayIndex, "afternoon_start", sourceShift.afternoon_start);
      onShiftChange(dayIndex, "afternoon_end", sourceShift.afternoon_end);
    });

    // Reset copy mode
    setShowCopyMode(false);
    setCopyFromDay(null);
    setSelectedDays([]);
  };

  const handleDaySelection = (dayIndex: number, checked: boolean) => {
    if (checked) {
      setSelectedDays((prev) => [...prev, dayIndex]);
    } else {
      setSelectedDays((prev) => prev.filter((index) => index !== dayIndex));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Weekly Schedule</CardTitle>
          {editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCopyMode(!showCopyMode)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Schedule
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {showCopyMode && editing && (
          <div className="mb-6 p-4 border rounded-lg bg-blue-50">
            <h4 className="font-medium mb-3">Copy Schedule</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Copy from:</Label>
                <div className="flex gap-2 mt-1">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <Button
                      key={day}
                      variant={copyFromDay === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCopyFromDay(index)}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Copy to:</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`copy-to-${index}`}
                        checked={selectedDays.includes(index)}
                        onCheckedChange={(checked) =>
                          handleDaySelection(index, checked as boolean)
                        }
                        disabled={copyFromDay === index}
                      />
                      <Label htmlFor={`copy-to-${index}`} className="text-sm">
                        {day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCopySchedule}
                  disabled={copyFromDay === null || selectedDays.length === 0}
                >
                  Apply Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCopyMode(false);
                    setCopyFromDay(null);
                    setSelectedDays([]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day, index) => {
            const shift = editing ? editShifts[index] : shifts[index];
            return (
              <div
                key={day}
                className="flex items-center gap-4 p-3 border rounded-lg"
              >
                <div className="w-20 font-medium">{day}</div>

                {editing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={shift.is_working_day}
                        onChange={(e) =>
                          onShiftChange(
                            index,
                            "is_working_day",
                            e.target.checked,
                          )
                        }
                        className="rounded"
                      />
                      <Label className="text-xs">Working</Label>
                    </div>

                    {shift.is_working_day && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Morning</Label>
                          <Input
                            type="time"
                            value={shift.morning_start || ""}
                            onChange={(e) =>
                              onShiftChange(
                                index,
                                "morning_start",
                                e.target.value,
                              )
                            }
                            className="w-28"
                          />
                          <span className="text-sm text-gray-500">to</span>
                          <Input
                            type="time"
                            value={shift.morning_end || ""}
                            onChange={(e) =>
                              onShiftChange(
                                index,
                                "morning_end",
                                e.target.value,
                              )
                            }
                            className="w-28"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Afternoon</Label>
                          <Input
                            type="time"
                            value={shift.afternoon_start || ""}
                            onChange={(e) =>
                              onShiftChange(
                                index,
                                "afternoon_start",
                                e.target.value,
                              )
                            }
                            className="w-28"
                          />
                          <span className="text-sm text-gray-500">to</span>
                          <Input
                            type="time"
                            value={shift.afternoon_end || ""}
                            onChange={(e) =>
                              onShiftChange(
                                index,
                                "afternoon_end",
                                e.target.value,
                              )
                            }
                            className="w-28"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-4">
                    {shift.is_working_day ? (
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          className="bg-green-50 text-green-700"
                        >
                          Working
                        </Badge>
                        {shift.morning_start && shift.morning_end && (
                          <span className="text-sm">
                            Morning: {shift.morning_start} - {shift.morning_end}
                          </span>
                        )}
                        {shift.afternoon_start && shift.afternoon_end && (
                          <span className="text-sm">
                            Afternoon: {shift.afternoon_start} -{" "}
                            {shift.afternoon_end}
                          </span>
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-gray-50 text-gray-500"
                      >
                        Off
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
