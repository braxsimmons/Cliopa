import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { UserRole } from "./useUserRoles";
import { toast } from "@/components/ui/use-toast";
import { useUserOperations } from "./useUserOperations";
import { User } from "@/types/user";
import { ProfileSelectAllColumns } from "@/services/ProfilesService";

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { updateUser: updateUserProfile, deleteUser: deleteUserProfile } =
    useUserOperations();

  const fetchUsers = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all profiles including team information
      const profiles = await ProfileSelectAllColumns();

      setUsers(profiles);
    } catch (error) {
      console.error("Unexpected error fetching users:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (
    userId: string,
    updates: {
      first_name?: string;
      last_name?: string;
      hourly_rate?: number;
      role?: UserRole;
    },
  ) => {
    const success = await updateUserProfile(userId, updates);
    if (success) {
      await fetchUsers();
    }
    return success;
  };

  const deleteUser = async (userId: string) => {
    const success = await deleteUserProfile(userId);
    if (success) {
      await fetchUsers();
    }
    return success;
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  return {
    users,
    loading,
    fetchUsers,
    updateUser,
    deleteUser,
  };
};
