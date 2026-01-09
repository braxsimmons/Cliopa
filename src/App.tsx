import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { AuthPage } from "@/components/auth/AuthPage";
import { AgentDashboard } from "@/components/dashboard/AgentDashboard";
import { AgentClockPage } from "@/components/dashboard/AgentClockPage";
import { MainLayout } from "@/components/layout/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import NotFound from "./pages/NotFound";
import UserProfilePage from "@/pages/UserProfilePage";
import ReportCardsPage from "@/pages/ReportCardsPage";
import { FullPageLoader } from "@/components/ui/loading-spinner";

// Lazy load admin/manager pages to reduce initial bundle size
const AdminPanelPage = lazy(() => import("@/pages/AdminPanelPage"));
const ShiftReportPage = lazy(() => import("./pages/ShiftReportPage"));
const TimeOffApprovalPage = lazy(() => import("./pages/TimeOffApprovalPage"));
const TimeOffReportPage = lazy(() => import("./pages/TimeOffReportPage"));
const UTOReportPage = lazy(() => import("./pages/UTOReportPage"));
const TimeCorrectionApprovalsPage = lazy(() => import("./pages/TimeCorrectionApprovalsPage"));
const AuditUploadPage = lazy(() => import("@/pages/AuditUploadPage"));
const Five9ConfigPage = lazy(() => import("@/pages/Five9ConfigPage").then(m => ({ default: m.Five9ConfigPage })));
const AuditTemplatesPage = lazy(() => import("@/pages/AuditTemplatesPage"));
const ShiftSchedulerPage = lazy(() => import("@/pages/ShiftSchedulerPage"));
const PayrollExportPage = lazy(() => import("@/pages/PayrollExportPage"));
const CompanySettingsPage = lazy(() => import("@/pages/CompanySettingsPage"));
const AnnouncementsPage = lazy(() => import("@/pages/AnnouncementsPage"));
const PerformanceDashboardPage = lazy(() => import("@/pages/PerformanceDashboardPage"));
const CoachingPage = lazy(() => import("@/pages/CoachingPage"));
const ConversationIntelligencePage = lazy(() => import("@/pages/ConversationIntelligencePage"));
const CallImportPage = lazy(() => import("@/pages/CallImportPage"));
const AISettingsPage = lazy(() => import("@/pages/AISettingsPage"));
const AnalyticsDashboardsPage = lazy(() => import("@/pages/AnalyticsDashboardsPage"));

// Suspense fallback for lazy loaded pages
const PageLoader = () => <FullPageLoader message="Loading..." />;

// Helper to wrap pages with error boundary
const withPageError = (Component: React.ComponentType, pageName: string) => (
  <PageErrorBoundary pageName={pageName}>
    <Component />
  </PageErrorBoundary>
);

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
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Agents see simplified clock page, managers/admins see full dashboard */}
          <Route
            path="/"
            element={
              canManageAllTimeEntries() ? <AgentDashboard /> : <AgentClockPage />
            }
          />
          {/* Full dashboard always accessible at /dashboard */}
          <Route path="/dashboard" element={<AgentDashboard />} />
          <Route
            path="/admin"
            element={canManageUsers() ? withPageError(AdminPanelPage, "Admin Panel") : <NotFound />}
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
              canManageAllTimeEntries() ? withPageError(ShiftSchedulerPage, "Shift Scheduler") : <NotFound />
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
            element={canManageUsers() ? withPageError(PayrollExportPage, "Payroll Export") : <NotFound />}
          />
          <Route
            path="/settings"
            element={canManageUsers() ? withPageError(CompanySettingsPage, "Company Settings") : <NotFound />}
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
              canManageAllTimeEntries() ? withPageError(PerformanceDashboardPage, "Performance Dashboard") : <NotFound />
            }
          />
          <Route
            path="/coaching"
            element={
              canManageAllTimeEntries() ? withPageError(CoachingPage, "Coaching") : <NotFound />
            }
          />
          <Route
            path="/conversation-intelligence"
            element={
              canManageAllTimeEntries() ? withPageError(ConversationIntelligencePage, "Conversation Intelligence") : <NotFound />
            }
          />
          {/* Compliance Alerts - merged into /conversation-intelligence as a tab */}
          {/* <Route
            path="/compliance-alerts"
            element={
              canManageAllTimeEntries() ? <ComplianceAlertsPage /> : <NotFound />
            }
          /> */}
          {/* Call Library - disabled, use Analytics for browsing calls */}
          {/* <Route
            path="/call-library"
            element={
              canManageAllTimeEntries() ? <CallLibraryPage /> : <NotFound />
            }
          /> */}
          <Route
            path="/call-import"
            element={
              canManageAllTimeEntries() ? <CallImportPage /> : <NotFound />
            }
          />
          {/* Admin Reports - merged into /performance as a tab */}
          {/* <Route
            path="/admin-reports"
            element={
              canManageUsers() ? <AdminReportsPage /> : <NotFound />
            }
          /> */}
          <Route
            path="/ai-settings"
            element={
              canManageUsers() ? withPageError(AISettingsPage, "AI Settings") : <NotFound />
            }
          />
          <Route
            path="/analytics"
            element={
              canManageUsers() ? withPageError(AnalyticsDashboardsPage, "Analytics Dashboards") : <NotFound />
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
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
