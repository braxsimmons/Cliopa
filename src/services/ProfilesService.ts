import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeData } from "@/types/employee";

export const ProfileSelectAllColumns = async () => {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select(
      `id
            , email
            , first_name
            , last_name
            , hourly_rate
            , role
            , start_date
            , team
            , sub_team
        `
    )
    .order("created_at", { ascending: false });

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    toast({
      title: "Error",
      description: "Failed to fetch users",
      variant: "destructive",
    });
    return;
  }

  return profiles;
};

export const ProfileSelectAllColumnsForAUser = async (userId: string) => {
  const { data, error } = await supabase.rpc(
    "get_profile_with_time_off_balance",
    { target_user_id: userId }
  );

  console.log("Profile query result:", { data, error });

  if (error) {
    console.error("Error fetching profile:", error);
    if (error.code === "PGRST116") {
      console.log("Profile not found, user may need to sign out and back in");
    }
  } else if (data) {
    console.log("Successfully fetched profile:", data);
    return data[0];
  }
};

export const ProfileSelectBasic = async (userId: string) => {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("id", userId)
    .single();

  return { profiles, profilesError };
};

export const ProfileUpdate = async (
  userId: string,
  editForm: Partial<EmployeeData>
) => {
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      hourly_rate: editForm.hourly_rate,
      start_date: editForm.start_date,
      birthday: editForm.birthday,
      team: editForm.team,
      sub_team: editForm.sub_team,
      pto_rule_advance_at: editForm.pto_rule_advance_at,
      employment_type: editForm.employment_type,
    })
    .eq("id", userId);
  return profileError;
};

export const ProfilesPartialUpdate = async (
  userId: string,
  updates: {
    first_name?: string;
    last_name?: string;
    hourly_rate?: number;
    role?: string;
    team?: string;
    start_date?: string;
    employment_type?: string;
  }
) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  return error;
};

export const ProfilesDelete = async (userId: string) => {
  const { error: profileError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);

  return profileError;
};

export const ProfilesPTORuleUpdate = async (
  userId: string,
  rule_id: string
) => {
  const { error } = await supabase
    .from("profiles")
    .update({ pto_rule: rule_id })
    .eq("id", userId);

  return error;
};

export const ProfilesUTORuleUpdate = async (
  userId: string,
  rule_id: string
) => {
  const { error } = await supabase
    .from("profiles")
    .update({ uto_rule: rule_id })
    .eq("id", userId);

  return error;
};

export const ProfilesSelectRoleForUser = async (userId: string) => {
  const { data: userRole, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId);

  return { userRole, error };
};

/**
 * Check if a profile has the correct pto rule and update it if not
 * @param userId id of the user to check
 */
export const ProfileVerifyPtoRule = async (userId: string) => {
  try {
    const { data: verifyRuleData, error: verifyRuleError } = await supabase
      .from("profiles")
      .select(
        `pto_rule_advance_at,
          pto_rule:time_off_rules!pto_rule_fkey (
          id,
          progression
          )
      `
      )
      .eq("id", userId)
      .single();

    // Exit early if no data, error, or missing required fields
    if (verifyRuleError || !verifyRuleData) {
      console.log("ProfileVerifyPtoRule: No profile data found for user", userId);
      return;
    }

    if (!verifyRuleData.pto_rule_advance_at || !verifyRuleData.pto_rule) {
      console.log("ProfileVerifyPtoRule: Missing PTO rule data for user", userId);
      return;
    }

    const now = new Date();
    const parts = verifyRuleData.pto_rule_advance_at.split("-"); // ["2025","08","13"]
    const updateDate = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2])
    );
    if (now >= updateDate && verifyRuleData.pto_rule["progression"] !== null) {
      const newDate = new Date(
        parseInt(parts[0]) + 1,
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      await supabase
        .from("profiles")
        .update({
          pto_rule: verifyRuleData.pto_rule["progression"],
          pto_rule_advance_at: newDate,
        })
        .eq("id", userId);
    }
  } catch (error) {
    console.error("ProfileVerifyPtoRule: Unexpected error", error);
    // Don't throw - this is a non-critical background operation
  }
};
