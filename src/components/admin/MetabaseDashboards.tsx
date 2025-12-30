import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DollarSign,
  Clock,
  Target,
  TrendingUp,
  Award,
  RefreshCw,
  ExternalLink,
  Maximize2,
  Plus,
  Settings,
  Pencil,
  Trash2,
  BarChart3,
  PieChart,
  Activity,
  Users,
  Phone,
  FileText,
  Loader2,
  GripVertical,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Icon mapping for dynamic icons
const ICON_MAP: Record<string, React.ReactNode> = {
  Clock: <Clock className="w-5 h-5" />,
  DollarSign: <DollarSign className="w-5 h-5" />,
  Target: <Target className="w-5 h-5" />,
  TrendingUp: <TrendingUp className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
  BarChart3: <BarChart3 className="w-5 h-5" />,
  PieChart: <PieChart className="w-5 h-5" />,
  Activity: <Activity className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Phone: <Phone className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const CATEGORY_OPTIONS = [
  { value: 'payroll', label: 'Payroll' },
  { value: 'performance', label: 'Performance' },
  { value: 'calls', label: 'Calls & Quality' },
  { value: 'general', label: 'General' },
];

interface DashboardEmbed {
  id: string;
  title: string;
  description: string | null;
  url: string;
  icon: string;
  category: string;
  display_order: number;
  is_active: boolean;
}

interface DashboardFormData {
  title: string;
  description: string;
  url: string;
  icon: string;
  category: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: DashboardFormData = {
  title: '',
  description: '',
  url: '',
  icon: 'BarChart3',
  category: 'general',
  is_active: true,
};

const MetabaseEmbed: React.FC<{
  dashboard: DashboardEmbed;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}> = ({ dashboard, onEdit, onDelete, isAdmin }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    const iframe = document.getElementById(`iframe-${dashboard.id}`) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openExternal = () => {
    window.open(dashboard.url, '_blank');
  };

  const icon = ICON_MAP[dashboard.icon] || ICON_MAP['BarChart3'];

  return (
    <Card className={`bg-white border border-[var(--color-border)] ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-[var(--color-text)]">
                {dashboard.title}
              </CardTitle>
              <p className="text-sm text-[var(--color-subtext)]">{dashboard.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onEdit}
                  className="text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDelete}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-[var(--color-subtext)] hover:text-[var(--color-text)]"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="text-[var(--color-subtext)] hover:text-[var(--color-text)]"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openExternal}
              className="text-[var(--color-subtext)] hover:text-[var(--color-text)]"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className={`relative ${isFullscreen ? 'h-[calc(100vh-12rem)]' : 'h-[400px]'} bg-gray-50 rounded-lg overflow-hidden`}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--color-subtext)]">Loading dashboard...</span>
              </div>
            </div>
          )}
          <iframe
            id={`iframe-${dashboard.id}`}
            src={dashboard.url}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            title={dashboard.title}
            allowFullScreen
          />
        </div>
      </CardContent>
    </Card>
  );
};

export const MetabaseDashboards: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<DashboardEmbed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showManageMode, setShowManageMode] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<DashboardEmbed | null>(null);
  const [formData, setFormData] = useState<DashboardFormData>(DEFAULT_FORM_DATA);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadDashboards();
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    setIsAdmin(data?.role === 'admin');
  };

  const loadDashboards = async () => {
    try {
      const { data, error } = await supabase
        .from('dashboard_embeds')
        .select('*')
        .order('category')
        .order('display_order');

      if (error) throw error;
      setDashboards(data || []);
    } catch (error) {
      console.error('Failed to load dashboards:', error);
      // Fall back to empty state - user can add dashboards
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.url) {
      toast({
        title: 'Missing fields',
        description: 'Title and URL are required.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingDashboard) {
        // Update existing
        const { error } = await supabase
          .from('dashboard_embeds')
          .update({
            title: formData.title,
            description: formData.description || null,
            url: formData.url,
            icon: formData.icon,
            category: formData.category,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDashboard.id);

        if (error) throw error;
        toast({ title: 'Dashboard updated' });
      } else {
        // Create new
        const maxOrder = Math.max(...dashboards.filter(d => d.category === formData.category).map(d => d.display_order), 0);
        const { error } = await supabase
          .from('dashboard_embeds')
          .insert({
            title: formData.title,
            description: formData.description || null,
            url: formData.url,
            icon: formData.icon,
            category: formData.category,
            is_active: formData.is_active,
            display_order: maxOrder + 1,
            created_by: user?.id,
          });

        if (error) throw error;
        toast({ title: 'Dashboard added' });
      }

      setShowDialog(false);
      setEditingDashboard(null);
      setFormData(DEFAULT_FORM_DATA);
      loadDashboards();
    } catch (error: any) {
      console.error('Failed to save dashboard:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save dashboard.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (dashboard: DashboardEmbed) => {
    setEditingDashboard(dashboard);
    setFormData({
      title: dashboard.title,
      description: dashboard.description || '',
      url: dashboard.url,
      icon: dashboard.icon,
      category: dashboard.category,
      is_active: dashboard.is_active,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('dashboard_embeds')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Dashboard deleted' });
      setDeleteConfirm(null);
      loadDashboards();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete dashboard.',
        variant: 'destructive',
      });
    }
  };

  const handleAddNew = () => {
    setEditingDashboard(null);
    setFormData(DEFAULT_FORM_DATA);
    setShowDialog(true);
  };

  const activeDashboards = dashboards.filter(d => d.is_active || isAdmin);
  const categories = [...new Set(activeDashboards.map(d => d.category))];
  const getCategoryLabel = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat)?.label || cat;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Analytics Dashboards</h1>
          <p className="text-[var(--color-subtext)]">
            Real-time payroll and performance metrics
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant={showManageMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowManageMode(!showManageMode)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showManageMode ? 'Done Managing' : 'Manage Dashboards'}
            </Button>
            {showManageMode && (
              <Button size="sm" onClick={handleAddNew}>
                <Plus className="w-4 h-4 mr-2" />
                Add Dashboard
              </Button>
            )}
          </div>
        )}
      </div>

      {dashboards.length === 0 ? (
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">No Dashboards Configured</h3>
          <p className="text-[var(--color-subtext)] mb-4">
            {isAdmin
              ? 'Add your first embedded dashboard to get started.'
              : 'No dashboards have been configured yet. Contact an admin to set them up.'}
          </p>
          {isAdmin && (
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" />
              Add Dashboard
            </Button>
          )}
        </Card>
      ) : (
        <Tabs defaultValue={categories[0] || 'all'} className="w-full">
          <TabsList className="bg-gray-100 p-1">
            {categories.map((cat) => {
              const count = activeDashboards.filter(d => d.category === cat).length;
              const IconComponent = cat === 'payroll' ? DollarSign : cat === 'performance' ? TrendingUp : BarChart3;
              return (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="data-[state=active]:bg-white data-[state=active]:text-[var(--color-text)]"
                >
                  <IconComponent className="w-4 h-4 mr-2" />
                  {getCategoryLabel(cat)} ({count})
                </TabsTrigger>
              );
            })}
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-white data-[state=active]:text-[var(--color-text)]"
            >
              All Dashboards
            </TabsTrigger>
          </TabsList>

          {categories.map((cat) => (
            <TabsContent key={cat} value={cat} className="mt-6">
              <div className="grid gap-6">
                {activeDashboards
                  .filter(d => d.category === cat)
                  .map((dashboard) => (
                    <div key={dashboard.id} className="relative">
                      {!dashboard.is_active && (
                        <div className="absolute top-2 left-2 z-10 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Inactive
                        </div>
                      )}
                      <MetabaseEmbed
                        dashboard={dashboard}
                        isAdmin={showManageMode}
                        onEdit={() => handleEdit(dashboard)}
                        onDelete={() => setDeleteConfirm(dashboard.id)}
                      />
                    </div>
                  ))}
              </div>
            </TabsContent>
          ))}

          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {activeDashboards.map((dashboard) => (
                <div key={dashboard.id} className="relative">
                  {!dashboard.is_active && (
                    <div className="absolute top-2 left-2 z-10 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                      Inactive
                    </div>
                  )}
                  <MetabaseEmbed
                    dashboard={dashboard}
                    isAdmin={showManageMode}
                    onEdit={() => handleEdit(dashboard)}
                    onDelete={() => setDeleteConfirm(dashboard.id)}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDashboard ? 'Edit Dashboard' : 'Add Dashboard'}</DialogTitle>
            <DialogDescription>
              {editingDashboard
                ? 'Update the dashboard configuration below.'
                : 'Add a new embedded dashboard. Use Metabase public share links or any embeddable URL.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Hours & OT Pay"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="CCM hours, overtime hours, and pay for last pay period"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Embed URL *</Label>
              <Input
                id="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="http://metabase.example.com/public/question/..."
              />
              <p className="text-xs text-[var(--color-subtext)]">
                Use Metabase public share links or any embeddable URL
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Icon</Label>
                <Select
                  value={formData.icon}
                  onValueChange={(value) => setFormData({ ...formData, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        <div className="flex items-center gap-2">
                          {ICON_MAP[icon]}
                          <span>{icon}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-[var(--color-subtext)]">
                  Inactive dashboards are hidden from non-admins
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingDashboard ? 'Update Dashboard' : 'Add Dashboard'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Dashboard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this dashboard? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MetabaseDashboards;
