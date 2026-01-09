import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PerformanceDashboard } from '@/components/admin/PerformanceDashboard';
import AdminReportsPage from './AdminReportsPage';
import { Sparkles, BarChart3 } from 'lucide-react';

/**
 * Performance Hub - Consolidated performance monitoring
 * Combines real-time performance intelligence with detailed audit reports
 */
const PerformanceDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('intelligence');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Performance Hub</h1>
        <p className="text-[var(--color-subtext)] mt-1">
          Real-time agent monitoring, performance trends, and detailed audit analytics
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Performance Intelligence
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Audit Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <PerformanceDashboard />
        </TabsContent>

        <TabsContent value="reports">
          <AdminReportsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceDashboardPage;
