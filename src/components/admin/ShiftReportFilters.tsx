import { Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/admin/DateRangePicker";
import { Button } from "../ui/button";

interface ShiftReportFiltersProps {
  entryTypeFilter: string;
  setEntryTypeFilter: (value: string) => void;
  startDate: Date | undefined;
  endDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  setEndDate: (date: Date | undefined) => void;
  employeeFilter: string;
  setEmployeeFilter: (value: string) => void;
}

export const ShiftReportFilters = ({
  entryTypeFilter,
  setEntryTypeFilter,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  employeeFilter,
  setEmployeeFilter,
}: ShiftReportFiltersProps) => {
  const ClearFilter = () => {
    setEntryTypeFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
    setEmployeeFilter("");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </div>
          <Button variant="default" onClick={ClearFilter}>
            Clear
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Entry Type</label>
            <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="time_off">PTO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
          <div>
            <label className="text-sm font-medium mb-2 block">Employee</label>
            <Input
              type="text"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Search by name or email"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
