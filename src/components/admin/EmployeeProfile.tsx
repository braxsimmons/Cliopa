import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Save, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useUserRoles } from "@/hooks/useUserRoles";
import { EmployeeData, ShiftData, DAYS_OF_WEEK } from "@/types/employee";
import { EmployeeBasicInfo } from "./EmployeeBasicInfo";
import { EmployeeSchedule } from "./EmployeeSchedule";
import {
  ProfileSelectAllColumnsForAUser,
  ProfilesPTORuleUpdate,
  ProfilesUTORuleUpdate,
  ProfileUpdate,
} from "@/services/ProfilesService";
import {
  EmployeeShiftsDelete,
  EmployeeShiftsInsert,
  EmployeeShiftsSelectShiftTimes,
} from "@/services/EmplyeeShiftService";
import {
  TimeOffRulesSelectAllPTOColumns,
  TimeOffRulesSelectAllUtoColumns,
} from "@/services/TimeOffRulesService";
import { EmployeeTimeEntries } from "./EmployeeTimeEntries";
import { EmployeeTimeOff } from "./EmployeeTimeOff";

interface EmployeeProfileProps {
  userId: string;
  onBack: () => void;
  allowEdit?: boolean; // <-- New: can this user edit?
  isSelfProfile?: boolean; // For possible extra customizations, like headline wording
}

export interface TimeOffRuleData {
  id: string;
  name: string;
  value: number;
}

// The rest of the code is the same EXCEPT: Disable editing UI if allowEdit is not true

export const EmployeeProfile = ({
  userId,
  onBack,
  allowEdit = true,
  isSelfProfile = false,
}: EmployeeProfileProps) => {
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [shifts, setShifts] = useState<ShiftData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<EmployeeData>>({});
  const [editShifts, setEditShifts] = useState<ShiftData[]>([]);
  const [ptoTimeOffRules, setPtoTimeOffRules] = useState<TimeOffRuleData[]>([]);
  const [utoTimeOffRules, setUtoTimeOffRules] = useState<TimeOffRuleData[]>([]);
  const { canManageAllTimeEntries } = useUserRoles();

  useEffect(() => {
    fetchEmployeeData();
    fetchTimeOffRules();
  }, [userId]);

  const fetchTimeOffRules = async () => {
    const { data, error } = await TimeOffRulesSelectAllPTOColumns();
    if (!error) {
      setPtoTimeOffRules(data);
    } else {
      console.log(error);
    }
    const { data: utoData, error: utoError } =
      await TimeOffRulesSelectAllUtoColumns();
    if (!utoError) {
      setUtoTimeOffRules(utoData);
    } else {
      console.log(utoError);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      // Fetch employee profile
      const profile = await ProfileSelectAllColumnsForAUser(userId);
      setEmployee({
        ...profile,
      });
      setEditForm({
        ...profile,
      });

      // Fetch employee shifts
      const shiftsData = await EmployeeShiftsSelectShiftTimes(userId);
      // Create complete shift array (7 days)
      const completeShifts = DAYS_OF_WEEK.map((_, index) => {
        const existingShift = shiftsData?.find((s) => s.day_of_week === index);
        return (
          existingShift || {
            day_of_week: index,
            morning_start: null,
            morning_end: null,
            afternoon_start: null,
            afternoon_end: null,
            is_working_day: false,
          }
        );
      });
      setShifts(completeShifts);
      setEditShifts([...completeShifts]);
    } catch (error) {
      console.error("Unexpected error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const handleSave = async () => {
    if (!employee || !canManageAllTimeEntries()) return;
    try {
      // Update profile
      if (employee.start_date !== editForm.start_date) {
        const parts = editForm.start_date.split("-"); // ["2025","08","13"]
        const pto_rule_advance_at = new Date(
          parseInt(parts[0]) + 1, // Need to advance to the next year
          parseInt(parts[1]) - 1, // month is zero-based
          parseInt(parts[2])
        );
        editForm.pto_rule_advance_at = pto_rule_advance_at.toDateString();
      }
      const profileError = await ProfileUpdate(userId, editForm);
      if (profileError) {
        throw profileError;
      }

      if (editForm.pto_name !== employee.pto_name) {
        const ptoTimeOffRuleId = ptoTimeOffRules.find(
          (t) => t.name === editForm.pto_name
        );
        const timeOffRuleError = await ProfilesPTORuleUpdate(
          userId,
          ptoTimeOffRuleId.id
        );

        if (timeOffRuleError) {
          console.error(
            "Error saving PTO Balance time off rule:",
            timeOffRuleError
          );
          throw timeOffRuleError;
        }
      }
      if (editForm.uto_name !== employee.uto_name) {
        const utoTimeOffRuleId = utoTimeOffRules.find(
          (t) => t.name === editForm.uto_name
        );
        const timeOffRuleError = await ProfilesUTORuleUpdate(
          userId,
          utoTimeOffRuleId.id
        );

        if (timeOffRuleError) {
          console.error(
            "Error saving UTO Balance time off rule:",
            timeOffRuleError
          );
          throw timeOffRuleError;
        }
      }

      // Delete existing shifts first to avoid constraint violations
      const deleteError = await EmployeeShiftsDelete(userId);
      if (deleteError) {
        console.error("Error deleting existing shifts:", deleteError);
        throw deleteError;
      }

      // Insert new shifts
      const shiftsToInsert = editShifts.map((shift) => ({
        user_id: userId,
        day_of_week: shift.day_of_week,
        morning_start: shift.morning_start || null,
        morning_end: shift.morning_end || null,
        afternoon_start: shift.afternoon_start || null,
        afternoon_end: shift.afternoon_end || null,
        is_working_day: shift.is_working_day,
      }));

      const shiftError = await EmployeeShiftsInsert(shiftsToInsert);
      if (shiftError) {
        console.error("Error inserting shifts:", shiftError);
        throw shiftError;
      }
      toast({
        title: "Success",
        description: "Employee profile updated successfully",
      });
      setEditing(false);
      await fetchEmployeeData();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast({
        title: "Error",
        description: "Failed to update employee profile",
        variant: "destructive",
      });
    }
  };
  const handleFormUpdate = (updates: Partial<EmployeeData>) => {
    setEditForm((prev) => ({
      ...prev,
      ...updates,
    }));
  };
  const handleShiftChange = (
    dayIndex: number,
    field: keyof ShiftData,
    value: boolean | string
  ) => {
    setEditShifts((prev) =>
      prev.map((shift, index) =>
        index === dayIndex
          ? {
              ...shift,
              [field]: value,
            }
          : shift
      )
    );
  };

  // Editing enabled only if (allowEdit && canManageAllTimeEntries) when showing someone else's profile,
  // but for the self-profile, allowEdit controls whether the button appears at all.
  // If allowEdit = false, do not render edit button or allow editing
  const enableEditing = allowEdit && canManageAllTimeEntries();

  // For self-profile, only check allowEdit
  const editingPermitted = isSelfProfile ? allowEdit : enableEditing;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading employee profile...</div>
      </div>
    );
  }
  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Employee not found</div>
      </div>
    );
  }
  const employeeName =
    `${employee.first_name || ""} ${employee.last_name || ""}`.trim() ||
    employee.email;
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="bg-slate-400 hover:bg-slate-300"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {isSelfProfile ? "Back to Dashboard" : "Back to Users"}
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Employee Profile: {employeeName}
              </h1>
            </div>
            {editingPermitted && (
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <EmployeeBasicInfo
            employee={employee}
            editing={editingPermitted && editing}
            editForm={editForm}
            onUpdateForm={handleFormUpdate}
            ptoTimeOffRules={ptoTimeOffRules}
            utoTimeOffRules={utoTimeOffRules}
          />
          <EmployeeSchedule
            shifts={shifts}
            editing={editingPermitted && editing}
            editShifts={editShifts}
            onShiftChange={handleShiftChange}
          />
        </div>

        {/* Admin sections - Time Entries and Time Off */}
        {canManageAllTimeEntries() && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <EmployeeTimeEntries userId={userId} />
            <EmployeeTimeOff userId={userId} />
          </div>
        )}
      </main>
    </div>
  );
};
