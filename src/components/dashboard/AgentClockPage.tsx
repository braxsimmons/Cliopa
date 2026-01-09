import { TimeTracker } from "./TimeTracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, FileText, User } from "lucide-react";
import { AnnouncementsBanner } from "./AnnouncementsBanner";

/**
 * Simplified landing page for agents - focused on clock in/out only.
 * All other features are accessible via the "View Full Dashboard" button.
 */
export const AgentClockPage = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          {getGreeting()}, {profile?.first_name || "there"}!
        </h1>
        <p className="text-sm text-[var(--color-subtext)] mt-1">
          Ready to start your shift?
        </p>
      </div>

      {/* Announcements */}
      <AnnouncementsBanner />

      {/* Centered Time Tracker */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <TimeTracker />
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="mt-8">
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 h-auto py-4 text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span className="text-xs">Full Dashboard</span>
              </Button>
              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 h-auto py-4 text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                onClick={() => navigate("/dashboard?tab=time-off")}
              >
                <Calendar className="h-5 w-5" />
                <span className="text-xs">Time Off</span>
              </Button>
              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 h-auto py-4 text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                onClick={() => navigate("/report-cards")}
              >
                <FileText className="h-5 w-5" />
                <span className="text-xs">Report Cards</span>
              </Button>
              <Button
                variant="ghost"
                className="flex flex-col items-center gap-2 h-auto py-4 text-[var(--color-text)] hover:bg-[var(--color-bg)]"
                onClick={() => navigate("/profile")}
              >
                <User className="h-5 w-5" />
                <span className="text-xs">My Profile</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Not signed in warning */}
      {!user && (
        <div className="mt-4 text-center">
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="py-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                Please sign in to track time
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
