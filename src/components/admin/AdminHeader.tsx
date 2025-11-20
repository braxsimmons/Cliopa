import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useNavigate } from "react-router-dom";

interface AdminHeaderProps {
  onBack: () => void;
}

export const AdminHeader = ({ onBack }: AdminHeaderProps) => {
  const { profile } = useProfile();
  const { userRoles } = useUserRoles();
  const navigate = useNavigate();

  const getEmployeeName = () => {
    if (profile?.first_name || profile?.last_name) {
      return `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim();
    }
    return profile?.email || "Employee";
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      case "ccm":
      case "crm":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPrimaryRole = () => {
    if (userRoles.length === 0) return null;
    // Return the first role, or prioritize admin/manager if present
    if (userRoles.includes("admin")) return "admin";
    if (userRoles.includes("manager")) return "manager";
    return userRoles[0];
  };

  return (
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
              Back to Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <div className="text-right">
              <div className="flex items-center gap-2">
                <button
                  className="font-medium text-gray-900 hover:underline focus:outline-none"
                  onClick={() => navigate("/profile")}
                  tabIndex={0}
                  aria-label="View Profile"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {getEmployeeName()}
                </button>
                {getPrimaryRole() && (
                  <Badge
                    variant={getRoleBadgeVariant(getPrimaryRole()!)}
                    className="text-xs"
                  >
                    {getPrimaryRole()!.toUpperCase()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
