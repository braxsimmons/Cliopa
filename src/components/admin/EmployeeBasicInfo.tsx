import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertCircle } from "lucide-react";
import {
  EmployeeData,
  TEAM_OPTIONS,
  SUB_TEAM_OPTIONS,
  EMPLOYMENT_TYPE,
} from "@/types/employee";
import { format, parseISO } from "date-fns";
import { TimeOffRuleData } from "./EmployeeProfile";

interface EmployeeBasicInfoProps {
  employee: EmployeeData;
  editing: boolean;
  editForm: Partial<EmployeeData>;
  onUpdateForm: (updates: Partial<EmployeeData>) => void;
  ptoTimeOffRules: TimeOffRuleData[];
  utoTimeOffRules: TimeOffRuleData[];
}

export const EmployeeBasicInfo = ({
  employee,
  editing,
  editForm,
  onUpdateForm,
  ptoTimeOffRules,
  utoTimeOffRules,
}: EmployeeBasicInfoProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name</Label>
            {editing ? (
              <Input
                id="first_name"
                value={editForm.first_name || ""}
                onChange={(e) => onUpdateForm({ first_name: e.target.value })}
              />
            ) : (
              <div className="text-sm py-2">
                {employee.first_name || "Not set"}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="last_name">Last Name</Label>
            {editing ? (
              <Input
                id="last_name"
                value={editForm.last_name || ""}
                onChange={(e) => onUpdateForm({ last_name: e.target.value })}
              />
            ) : (
              <div className="text-sm py-2">
                {employee.last_name || "Not set"}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="text-sm py-2">{employee.email}</div>
          </div>

          <div>
            <Label htmlFor="EmploymentType">Employment Type</Label>
            {editing ? (
              <Select
                value={editForm.employment_type || ""}
                onValueChange={(value) => onUpdateForm({ employment_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employment type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm py-2">
                {employee.employment_type || "Not assigned"}
              </div>
            )}
          </div>
        </div>


        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hourly_rate">Hourly Rate</Label>
            {editing ? (
              <Input
                id="hourly_rate"
                type="number"
                step="0.01"
                value={editForm.hourly_rate || ""}
                onChange={(e) =>
                  onUpdateForm({ hourly_rate: parseFloat(e.target.value) || 0 })
                }
              />
            ) : (
              <div className="text-sm py-2">
                ${employee.hourly_rate?.toFixed(2) || "0.00"}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="team">Team</Label>
            {editing ? (
              <Select
                value={editForm.team || ""}
                onValueChange={(value) => onUpdateForm({ team: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_OPTIONS.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm py-2">
                {employee.team?.toLocaleUpperCase() || "Not assigned"}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sub_team">Sub Team</Label>
            {editing ? (
              <Select
                value={editForm.sub_team || ""}
                onValueChange={(value) => onUpdateForm({ sub_team: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub team" />
                </SelectTrigger>
                <SelectContent>
                  {SUB_TEAM_OPTIONS.map((subTeam) => (
                    <SelectItem key={subTeam} value={subTeam}>
                      {subTeam}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-sm py-2">
                {employee.sub_team || "Not assigned"}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="start_date">Start Date</Label>
            {editing ? (
              <Input
                id="start_date"
                type="date"
                value={editForm.start_date || ""}
                onChange={(e) => onUpdateForm({ start_date: e.target.value })}
              />
            ) : (
              <div className="text-sm py-2">
                {employee.start_date
                  ? format(parseISO(employee.start_date), "P")
                  : "Not set"}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="birthday">Birthday</Label>
            {editing ? (
              <Input
                id="birthday"
                type="date"
                value={editForm.birthday || ""}
                onChange={(e) => onUpdateForm({ birthday: e.target.value })}
              />
            ) : (
              <div className="text-sm py-2">
                {employee.birthday
                  ? format(parseISO(employee.birthday), "P")
                  : "Not set"}
              </div>
            )}
          </div>
        </div>

        {/* PTO Information */}
        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4" />
            <h3 className="font-medium">PTO Information</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pto_balance">PTO Balance (Days)</Label>
              {editing ? (
                <Select
                  value={editForm.pto_name || ""}
                  onValueChange={(value) =>
                    onUpdateForm({ pto_name: value || "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select PTO" />
                  </SelectTrigger>
                  <SelectContent>
                    {ptoTimeOffRules.map((time) => (
                      <SelectItem key={time.id} value={time.name}>
                        {time.name} - {time.value} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm py-2 flex items-center gap-2">
                  {employee.available_pto || 0} days
                  {!employee.available_pto && employee.available_pto == 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Eligible
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>PTO Refresh Date</Label>
              <div className="text-sm py-2">
                {employee.time_off_end_date_pto
                  ? format(employee.time_off_end_date_pto, "yyyy-MM-dd")
                  : "Set start date and pto rule first"}
              </div>
            </div>
          </div>

          {employee && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual PTO Allowance</Label>
                <div className="text-sm py-2">{employee.max_pto} days</div>
              </div>
              <div>
                <Label>PTO Eligibility</Label>
                <div className="text-sm py-2">
                  {employee.available_pto > 0 ? (
                    <Badge variant="default">Eligible</Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary">Ineligible</Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* UTO Information */}
        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" />
            <h3 className="font-medium">UTO Information</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="uto_balance">UTO Balance (Days)</Label>
              {editing ? (
                <Select
                  value={editForm.uto_name || ""}
                  onValueChange={(value) =>
                    onUpdateForm({ uto_name: value || "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select UTO" />
                  </SelectTrigger>
                  <SelectContent>
                    {utoTimeOffRules.map((time) => (
                      <SelectItem key={time.id} value={time.name}>
                        {time.name} - {time.value} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm py-2 flex items-center gap-2">
                  {employee.available_uto || 0} days
                  {!employee.available_uto && employee.available_uto == 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Not Eligible
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Next UTO Reset</Label>
              <div className="text-sm py-2">
                {employee.time_off_end_date_uto
                  ? format(employee.time_off_end_date_uto, "yyyy-MM-dd")
                  : "Set start date and assign uto rule first"}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
