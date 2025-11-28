import { TimeTracker } from "./TimeTracker";
import { ShiftTable } from "./ShiftTable";
import { MyTimeCorrections } from "./MyTimeCorrections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Clock,
  Calendar,
  FileText,
  User,
  ChevronRight,
  Users,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { TimeOffTab } from "./TimeOffTab";
import { ShiftsNeedingApprovalTable } from "./ShiftsNeedingApproval";
import { DashboardAnalytics } from "./DashboardAnalytics";
import { UpcomingSchedule } from "./UpcomingSchedule";
import { TeamDashboard } from "./TeamDashboard";
import { AnnouncementsBanner } from "./AnnouncementsBanner";

export const AgentDashboard = () => {
  const { user } = useAuth();
  const { canManageUsers, userRoles, canManageAllTimeEntries } = useUserRoles();
  const { profile } = useProfile();
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
    if (userRoles.includes("admin")) return "admin";
    if (userRoles.includes("manager")) return "manager";
    return userRoles[0];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">
              {getGreeting()}, {profile?.first_name || "there"}!
            </h1>
            <p className="text-sm text-[var(--color-subtext)] mt-1">
              Here's your workforce dashboard for today
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors"
              onClick={() => navigate("/profile")}
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-sm font-medium">
                {getEmployeeName().charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {getEmployeeName()}
                </p>
                <div className="flex items-center gap-1">
                  {getPrimaryRole() && (
                    <Badge
                      variant={getRoleBadgeVariant(getPrimaryRole()!)}
                      className="text-xs h-5"
                    >
                      {getPrimaryRole()!.toUpperCase()}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--color-subtext)] hidden sm:block" />
            </button>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <AnnouncementsBanner />

      {/* Analytics Section */}
      <div className="mb-6">
        <DashboardAnalytics />
      </div>

      {/* Team Dashboard & Upcoming Schedule for Managers */}
      {canManageAllTimeEntries() && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <TeamDashboard />
          <UpcomingSchedule />
        </div>
      )}

      {/* Upcoming Schedule for Regular Employees */}
      {!canManageAllTimeEntries() && (
        <div className="mb-6">
          <UpcomingSchedule />
        </div>
      )}

      {/* Quick Actions for Managers */}
      {canManageAllTimeEntries() && (
        <div className="mb-6">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--color-text)]">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/shift-report")}
                  className="text-[var(--color-text)] border-[var(--color-border)]"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  View All Shifts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/time-off-approvals")}
                  className="text-[var(--color-text)] border-[var(--color-border)]"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Time Off Approvals
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/time-correction-approvals")}
                  className="text-[var(--color-text)] border-[var(--color-border)]"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Time Corrections
                </Button>
                {canManageUsers() && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/payroll")}
                      className="text-[var(--color-text)] border-[var(--color-border)]"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Payroll Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/admin")}
                      className="text-[var(--color-text)] border-[var(--color-border)]"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Manage Users
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="time-tracking" className="space-y-4">
        <TabsList className="bg-[var(--color-surface)] border border-[var(--color-border)] p-1">
          <TabsTrigger
            value="time-tracking"
            className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white"
          >
            <Clock className="h-4 w-4 mr-2" />
            Time Tracking
          </TabsTrigger>
          <TabsTrigger
            value="time-off"
            className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Time Off
          </TabsTrigger>
          <TabsTrigger
            value="corrections"
            className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white"
          >
            <FileText className="h-4 w-4 mr-2" />
            Corrections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="time-tracking" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Tracker */}
            <div>
              <TimeTracker />
            </div>

            {/* Shifts Needing Approval */}
            <div>
              <ShiftsNeedingApprovalTable />
            </div>
          </div>

          {/* Shift History */}
          <div>
            <ShiftTable />
          </div>
        </TabsContent>

        <TabsContent value="time-off" className="space-y-6">
          <TimeOffTab />
        </TabsContent>

        <TabsContent value="corrections" className="space-y-6">
          <MyTimeCorrections />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      {!user && (
        <div className="mt-8 text-center">
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="py-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                Please sign in to access all features
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
