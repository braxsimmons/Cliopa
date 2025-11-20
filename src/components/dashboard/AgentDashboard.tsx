import { TimeTracker } from "./TimeTracker";
import { ShiftTable } from "./ShiftTable";
import { MyTimeCorrections } from "./MyTimeCorrections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut,
  Clock,
  Calendar,
  FileText,
  Settings,
  User,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { TimeOffTab } from "./TimeOffTab";
import { ShiftsNeedingApprovalTable } from "./ShiftsNeedingApproval";

export const AgentDashboard = () => {
  const { signOut } = useAuth();
  const { canManageUsers, userRoles } = useUserRoles();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Agent Dashboard
            </h1>
            <div className="flex items-center gap-4">
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
              {canManageUsers() && (
                <Button variant="outline" asChild>
                  <a href="/admin">
                    <Settings className="h-4 w-4 mr-2" />
                    Admin Panel
                  </a>
                </Button>
              )}
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="time-tracking" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="time-tracking">
              <Clock className="h-4 w-4 mr-2" />
              Time Tracking
            </TabsTrigger>
            <TabsTrigger value="time-off">
              <Calendar className="h-4 w-4 mr-2" />
              Time Off
            </TabsTrigger>
            <TabsTrigger value="corrections">
              <FileText className="h-4 w-4 mr-2" />
              Time Corrections
            </TabsTrigger>
            {/* <TabsTrigger value="kpis">
              <BarChart3 className="h-4 w-4 mr-2" />
              KPIs
            </TabsTrigger> */}
          </TabsList>

          <TabsContent value="time-tracking" className="space-y-10">
            <div className="w-full flex flex-col items-center">
              <div className="max-w-xl w-full flex justify-center">
                <TimeTracker />
              </div>
              <div className="w-full flex flex-col items-center mt-5">
                <div className="max-w-2xl w-full flex justify-center">
                  <ShiftsNeedingApprovalTable />
                </div>
              </div>
              <div className="w-full flex flex-col items-center mt-3">
                <div className="max-w-2xl w-full flex justify-center">
                  <ShiftTable />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="time-off" className="space-y-6">
            <TimeOffTab />
          </TabsContent>

          <TabsContent value="corrections" className="space-y-6">
            <MyTimeCorrections />
          </TabsContent>

          {/* <TabsContent value="kpis" className="space-y-6">
            <KPITable />
          </TabsContent> */}
        </Tabs>
      </main>
    </div>
  );
};
