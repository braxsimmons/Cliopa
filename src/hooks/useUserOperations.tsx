import { toast } from "@/components/ui/use-toast";
import {
  ProfilesDelete,
  ProfilesPartialUpdate,
} from "@/services/ProfilesService";
import { UserRole } from "./useUserRoles";

export const useUserOperations = () => {
  const updateUser = async (
    userId: string,
    updates: {
      first_name?: string;
      last_name?: string;
      hourly_rate?: number;
      role?: UserRole;
    },
  ) => {
    try {
      const error = await ProfilesPartialUpdate(userId, updates);

      if (error) {
        console.error("Error updating user:", error);
        toast({
          title: "Error",
          description: "Failed to update user",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      return true;
    } catch (error) {
      console.error("Unexpected error updating user:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // Delete profile
      const profileError = await ProfilesDelete(userId);

      if (profileError) {
        console.error("Error deleting profile:", profileError);
        toast({
          title: "Error",
          description: "Failed to delete user",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "User deleted successfully",
      });

      return true;
    } catch (error) {
      console.error("Unexpected error deleting user:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    updateUser,
    deleteUser,
  };
};
