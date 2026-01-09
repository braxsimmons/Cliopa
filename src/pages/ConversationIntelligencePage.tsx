import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationAnalyticsDashboard } from '@/components/admin/ConversationAnalyticsDashboard';
import { KeywordLibraryManager } from '@/components/admin/KeywordLibraryManager';
import { ScriptTemplateEditor } from '@/components/admin/ScriptTemplateEditor';
import { ComplianceAlertsDashboard } from '@/components/admin/ComplianceAlertsDashboard';
import { ShieldAlert, BarChart3, Library, FileText } from 'lucide-react';

const ConversationIntelligencePage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Conversation Intelligence</h1>
        <p className="text-[var(--color-subtext)] mt-1">
          AI-powered call analytics, compliance monitoring, and conversation insights
        </p>
      </div>

      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="compliance" className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Compliance Alerts
          </TabsTrigger>
          <TabsTrigger value="keywords" className="flex items-center gap-2">
            <Library className="h-4 w-4" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="scripts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Scripts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <ConversationAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceAlertsDashboard />
        </TabsContent>

        <TabsContent value="keywords">
          <KeywordLibraryManager />
        </TabsContent>

        <TabsContent value="scripts">
          <ScriptTemplateEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConversationIntelligencePage;
