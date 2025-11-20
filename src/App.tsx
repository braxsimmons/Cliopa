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

const queryClient = new QueryClient();

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const {
    canManageUsers,
    isAdmin,
    canManageAllTimeEntries,
    loading: rolesLoading,
  } = useUserRoles();

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
