import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { ProfilesSelectRoleForUser } from "@/services/ProfilesService";

export type UserRole = "admin" | "manager" | "ccm" | "crm";

interface UserRoleData {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export const useUserRoles = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserRoles = async () => {
    if (!user?.id) {
      console.log("No user ID available for fetchUserRoles");
      setUserRoles([]);
      setLoading(false);
      return;
    }

    console.log("Fetching user roles for user:", user.id);

    try {
      const { userRole, error } = await ProfilesSelectRoleForUser(user.id);

      console.log("User roles query result:", { userRole, error });

      if (error) {
        console.error("Error fetching user roles:", error);
        setUserRoles([]);
      } else {
        const roles = userRole?.map((item) => item.role as UserRole) || [];
        console.log("Successfully fetched user roles:", roles);
        setUserRoles(roles);
      }
    } catch (error) {
      console.error("Unexpected error fetching user roles:", error);
      setUserRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      console.log("User authenticated, fetching roles for user:", user.id);
      fetchUserRoles();
    } else {
      console.log("No user authenticated, clearing roles");
      setUserRoles([]);
      setLoading(false);
    }
  }, [user]);

  const hasRole = (role: UserRole): boolean => {
    return userRoles.includes(role);
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some((role) => userRoles.includes(role));
  };

  const isAdmin = (): boolean => hasRole("admin");
  const isManager = (): boolean => hasRole("manager");
  const isCCM = (): boolean => hasRole("ccm");
  const isCRM = (): boolean => hasRole("crm");

  // Check if user can manage other users (admin or manager)
  const canManageUsers = (): boolean => hasAnyRole(["admin", "manager"]);

  // Check if user can view/edit all time entries (admin or manager)
  const canManageAllTimeEntries = (): boolean =>
    hasAnyRole(["admin", "manager"]);

  // Check if user can only manage their own shifts (ccm or crm)
  const canOnlyManageOwnShifts = (): boolean =>
    hasAnyRole(["ccm", "crm"]) && !canManageAllTimeEntries();

  return {
    userRoles,
    loading,
    hasRole,
    hasAnyRole,
    isAdmin,
    isManager,
    isCCM,
    isCRM,
    canManageUsers,
    canManageAllTimeEntries,
    canOnlyManageOwnShifts,
    refetch: fetchUserRoles,
  };
};
