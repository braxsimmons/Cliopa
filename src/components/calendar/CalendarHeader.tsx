import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";

interface CalendarHeaderProps {
  selectedTeam: string;
  onTeamChange: (team: string) => void;
  teams: string[];
  hideTeamFilter?: boolean;
}

export const CalendarHeader = ({
  selectedTeam,
  onTeamChange,
  teams,
  hideTeamFilter = false,
}: CalendarHeaderProps) => {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <CalendarIcon className="h-5 w-5" />
        Time Off Calendar
      </CardTitle>
      {!hideTeamFilter && (
        <div className="space-y-2">
          <Select value={selectedTeam} onValueChange={onTeamChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team} value={team || "no-team"}>
                  {team || "No Team"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </CardHeader>
  );
};
