import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AuthPage } from "@/components/auth/AuthPage";
import { AgentDashboard } from "@/components/dashboard/AgentDashboard";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdminPanelPage from "@/pages/AdminPanelPage";
import ShiftReportPage from "./pages/ShiftReportPage";
import TimeOffApprovalPage from "./pages/TimeOffApprovalPage";
import TimeOffReportPage from "./pages/TimeOffReportPage";
import UTOReportPage from "./pages/UTOReportPage";
import TimeCorrectionApprovalsPage from "./pages/TimeCorrectionApprovalsPage";
import NotFound from "./pages/NotFound";
import UserProfilePage from "@/pages/UserProfilePage";
import AuditUploadPage from "@/pages/AuditUploadPage";
import ReportCardsPage from "@/pages/ReportCardsPage";
import { Five9ConfigPage } from "@/pages/Five9ConfigPage";
import AuditTemplatesPage from "@/pages/AuditTemplatesPage";
import ShiftSchedulerPage from "@/pages/ShiftSchedulerPage";
import PayrollExportPage from "@/pages/PayrollExportPage";
import CompanySettingsPage from "@/pages/CompanySettingsPage";
import AnnouncementsPage from "@/pages/AnnouncementsPage";
import PerformanceDashboardPage from "@/pages/PerformanceDashboardPage";
import CoachingPage from "@/pages/CoachingPage";
import ConversationIntelligencePage from "@/pages/ConversationIntelligencePage";
import ComplianceAlertsPage from "@/pages/ComplianceAlertsPage";
import CallLibraryPage from "@/pages/CallLibraryPage";
import CallImportPage from "@/pages/CallImportPage";
import AdminReportsPage from "@/pages/AdminReportsPage";
import AISettingsPage from "@/pages/AISettingsPage";
import AnalyticsDashboardsPage from "@/pages/AnalyticsDashboardsPage";
import { FullPageLoader } from "@/components/ui/loading-spinner";

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    canManageUsers,
    canManageAllTimeEntries,
    loading: rolesLoading,
  } = useUserRoles();

  if (loading || rolesLoading) {
    return <FullPageLoader message="Initializing Cliopa.io..." />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<AgentDashboard />} />
          <Route path="/dashboard" element={<AgentDashboard />} />
          <Route
            path="/admin"
            element={canManageUsers() ? <AdminPanelPage /> : <NotFound />}
          />
          <Route path="/profile" element={<UserProfilePage />} />
          <Route path="/report-cards" element={<ReportCardsPage />} />
          <Route
            path="/audit-upload"
            element={canManageUsers() ? <AuditUploadPage /> : <NotFound />}
          />
          <Route
            path="/five9-config"
            element={canManageUsers() ? <Five9ConfigPage /> : <NotFound />}
          />
          <Route
            path="/audit-templates"
            element={canManageUsers() ? <AuditTemplatesPage /> : <NotFound />}
          />
          <Route
            path="/shift-scheduler"
            element={
              canManageAllTimeEntries() ? <ShiftSchedulerPage /> : <NotFound />
            }
          />
          <Route
            path="/shift-report"
            element={
              canManageAllTimeEntries() ? <ShiftReportPage /> : <NotFound />
            }
          />
          <Route
            path="/time-off-approvals"
            element={
              canManageAllTimeEntries() ? <TimeOffApprovalPage /> : <NotFound />
            }
          />
          <Route
            path="/time-correction-approvals"
            element={
              canManageAllTimeEntries() ? (
                <TimeCorrectionApprovalsPage />
              ) : (
                <NotFound />
              )
            }
          />
          <Route
            path="/time-off-report"
            element={canManageUsers() ? <TimeOffReportPage /> : <NotFound />}
          />
          <Route
            path="/uto-report"
            element={canManageUsers() ? <UTOReportPage /> : <NotFound />}
          />
          <Route
            path="/payroll"
            element={canManageUsers() ? <PayrollExportPage /> : <NotFound />}
          />
          <Route
            path="/settings"
            element={canManageUsers() ? <CompanySettingsPage /> : <NotFound />}
          />
          <Route
            path="/announcements"
            element={
              canManageAllTimeEntries() ? <AnnouncementsPage /> : <NotFound />
            }
          />
          <Route
            path="/performance"
            element={
              canManageAllTimeEntries() ? <PerformanceDashboardPage /> : <NotFound />
            }
          />
          <Route
            path="/coaching"
            element={
              canManageAllTimeEntries() ? <CoachingPage /> : <NotFound />
            }
          />
          <Route
            path="/conversation-intelligence"
            element={
              canManageAllTimeEntries() ? <ConversationIntelligencePage /> : <NotFound />
            }
          />
          <Route
            path="/compliance-alerts"
            element={
              canManageAllTimeEntries() ? <ComplianceAlertsPage /> : <NotFound />
            }
          />
          <Route
            path="/call-library"
            element={
              canManageAllTimeEntries() ? <CallLibraryPage /> : <NotFound />
            }
          />
          <Route
            path="/call-import"
            element={
              canManageAllTimeEntries() ? <CallImportPage /> : <NotFound />
            }
          />
          <Route
            path="/admin-reports"
            element={
              canManageUsers() ? <AdminReportsPage /> : <NotFound />
            }
          />
          <Route
            path="/ai-settings"
            element={
              canManageUsers() ? <AISettingsPage /> : <NotFound />
            }
          />
          <Route
            path="/analytics"
            element={
              canManageUsers() ? <AnalyticsDashboardsPage /> : <NotFound />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AppContent />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
