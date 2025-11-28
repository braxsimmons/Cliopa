import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { AnnouncementsService, Announcement, CreateAnnouncementInput } from '@/services/AnnouncementsService';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-blue-500',
  low: 'bg-gray-400',
};

export const AnnouncementsManager = () => {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateAnnouncementInput>({
    title: '',
    content: '',
    priority: 'normal',
    target_audience: 'all',
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await AnnouncementsService.getAllAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load announcements',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      toast({
        title: 'Error',
        description: 'Title and content are required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await AnnouncementsService.updateAnnouncement(editingId, formData);
        toast({ title: 'Updated', description: 'Announcement updated' });
      } else {
        await AnnouncementsService.createAnnouncement(formData);
        toast({ title: 'Created', description: 'Announcement published' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save announcement',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      target_audience: announcement.target_audience,
      target_team: announcement.target_team || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      await AnnouncementsService.updateAnnouncement(announcement.id, {
        is_active: !announcement.is_active,
      });
      toast({
        title: announcement.is_active ? 'Deactivated' : 'Activated',
        description: `Announcement ${announcement.is_active ? 'hidden' : 'visible'} to employees`,
      });
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update announcement',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      await AnnouncementsService.deleteAnnouncement(id);
      toast({ title: 'Deleted', description: 'Announcement removed' });
      fetchAnnouncements();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete announcement',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      title: '',
      content: '',
      priority: 'normal',
      target_audience: 'all',
    });
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Announcements</h1>
          <p className="text-[var(--color-subtext)]">Post updates and alerts for your team</p>
        </div>
        <Button onClick={openNewDialog} className="bg-[var(--color-accent)] text-white">
          <Plus className="h-4 w-4 mr-2" />
          New Announcement
        </Button>
      </div>

      {/* Announcements List */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-[var(--color-text)]">
            All Announcements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="h-12 w-12 mx-auto text-[var(--color-subtext)] mb-3" />
              <p className="text-[var(--color-subtext)]">No announcements yet</p>
              <Button variant="outline" onClick={openNewDialog} className="mt-4">
                Create your first announcement
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    announcement.is_active
                      ? 'bg-[var(--color-bg)] border-[var(--color-border)]'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-[var(--color-text)]">
                          {announcement.title}
                        </h3>
                        <Badge className={cn('text-white text-xs', PRIORITY_COLORS[announcement.priority])}>
                          {announcement.priority}
                        </Badge>
                        {!announcement.is_active && (
                          <Badge variant="outline" className="text-xs">
                            Hidden
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-[var(--color-subtext)] line-clamp-2">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-subtext)]">
                        <span>Target: {announcement.target_audience}</span>
                        <span>Created: {format(new Date(announcement.created_at), 'MMM d, yyyy')}</span>
                        {announcement.creator_name && <span>By: {announcement.creator_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(announcement)}
                        className="h-8 w-8"
                      >
                        {announcement.is_active ? (
                          <EyeOff className="h-4 w-4 text-[var(--color-subtext)]" />
                        ) : (
                          <Eye className="h-4 w-4 text-[var(--color-subtext)]" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(announcement)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4 text-[var(--color-subtext)]" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(announcement.id)}
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[var(--color-text)]">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Announcement title"
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Content</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your announcement..."
                rows={4}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--color-text)]">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--color-text)]">Target Audience</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value: any) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="managers">Managers Only</SelectItem>
                    <SelectItem value="employees">Employees Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[var(--color-accent)] text-white"
            >
              {saving ? <LoadingSpinner size="sm" /> : editingId ? 'Update' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
