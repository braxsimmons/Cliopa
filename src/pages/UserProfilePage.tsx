import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { EmployeeProfile } from "@/components/admin/EmployeeProfile";
import { useNavigate } from "react-router-dom";
import React from "react";

const UserProfilePage = () => {
  const { user } = useAuth();
  const { canManageUsers } = useUserRoles();
  const navigate = useNavigate();

  // Only show content if user is authenticated (should always be due to top-level checks, but be safe)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Not authenticated</div>
      </div>
    );
  }

  // Only allow editing if user is admin or manager
  const allowEdit = canManageUsers();

  return (
    <EmployeeProfile
      userId={user.id}
      onBack={() => navigate("/dashboard")}
      allowEdit={allowEdit}
      isSelfProfile={true}
    />
  );
};

export default UserProfilePage;
