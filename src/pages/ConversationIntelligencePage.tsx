import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationAnalyticsDashboard } from '@/components/admin/ConversationAnalyticsDashboard';
import { KeywordLibraryManager } from '@/components/admin/KeywordLibraryManager';
import { ScriptTemplateEditor } from '@/components/admin/ScriptTemplateEditor';

const ConversationIntelligencePage = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="analytics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analytics">Analytics Dashboard</TabsTrigger>
          <TabsTrigger value="keywords">Keyword Libraries</TabsTrigger>
          <TabsTrigger value="scripts">Script Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <ConversationAnalyticsDashboard />
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
