import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Star,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AuditTemplate,
  AuditCriterion,
  AuditDimension,
  getAuditTemplates,
  createAuditTemplate,
  updateAuditTemplate,
  deleteAuditTemplate,
  duplicateAuditTemplate,
  getDimensionColor,
  getAvailableDimensions,
} from '@/services/AuditTemplatesService';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';

// Criterion Editor Component
interface CriterionEditorProps {
  criterion: AuditCriterion;
  index: number;
  onChange: (criterion: AuditCriterion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const CriterionEditor: React.FC<CriterionEditorProps> = ({
  criterion,
  index,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) => {
  const [expanded, setExpanded] = useState(false);
  const dimensions = getAvailableDimensions();

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] overflow-hidden">
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-[var(--color-subtext)] flex-shrink-0" />
        <span className="text-sm font-mono text-[var(--color-subtext)] w-12">
          #{index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text)] truncate">
            {criterion.name || 'Untitled Criterion'}
          </p>
          <p className="text-xs text-[var(--color-subtext)] truncate">
            {criterion.id || 'No ID'}
          </p>
        </div>
        <Badge className={cn('text-xs', getDimensionColor(criterion.dimension))}>
          {criterion.dimension}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--color-subtext)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--color-subtext)]" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-4 bg-[var(--color-bg)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[var(--color-text)]">Criterion ID</Label>
              <Input
                value={criterion.id}
                onChange={(e) => onChange({ ...criterion, id: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                placeholder="e.g., QQ, VCI, PD1"
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] font-mono"
              />
              <p className="text-xs text-[var(--color-subtext)]">
                Unique identifier (auto-uppercase, no spaces)
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--color-text)]">Name</Label>
              <Input
                value={criterion.name}
                onChange={(e) => onChange({ ...criterion, name: e.target.value })}
                placeholder="e.g., Qualifying Questions"
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[var(--color-text)]">Description</Label>
            <Textarea
              value={criterion.description}
              onChange={(e) => onChange({ ...criterion, description: e.target.value })}
              placeholder="Describe what the auditor should evaluate..."
              rows={3}
              className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[var(--color-text)]">Dimension</Label>
              <Select
                value={criterion.dimension}
                onValueChange={(value) => onChange({ ...criterion, dimension: value as AuditDimension })}
              >
                <SelectTrigger className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {dimensions.map((dim) => (
                    <SelectItem key={dim.value} value={dim.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', getDimensionColor(dim.value).split(' ')[0])} />
                        {dim.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--color-text)]">Weight</Label>
              <Input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={criterion.weight}
                onChange={(e) => onChange({ ...criterion, weight: parseFloat(e.target.value) || 1 })}
                className="bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]"
              />
              <p className="text-xs text-[var(--color-subtext)]">
                Score multiplier (default: 1.0)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Template Editor Dialog
interface TemplateEditorDialogProps {
  template: AuditTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: AuditTemplate) => void;
}

const TemplateEditorDialog: React.FC<TemplateEditorDialogProps> = ({
  template,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [criteria, setCriteria] = useState<AuditCriterion[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setIsDefault(template.is_default);
      setCriteria(template.criteria);
    } else {
      setName('');
      setDescription('');
      setIsDefault(false);
      setCriteria([]);
    }
  }, [template, isOpen]);

  const addCriterion = () => {
    const newCriterion: AuditCriterion = {
      id: `NEW_${Date.now()}`,
      name: '',
      description: '',
      dimension: 'compliance',
      weight: 1.0,
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (index: number, updated: AuditCriterion) => {
    const newCriteria = [...criteria];
    newCriteria[index] = updated;
    setCriteria(newCriteria);
  };

  const deleteCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const moveCriterion = (index: number, direction: 'up' | 'down') => {
    const newCriteria = [...criteria];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newCriteria[index], newCriteria[newIndex]] = [newCriteria[newIndex], newCriteria[index]];
    setCriteria(newCriteria);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a template name',
        variant: 'destructive',
      });
      return;
    }

    if (criteria.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one criterion',
        variant: 'destructive',
      });
      return;
    }

    // Validate criteria
    const invalidCriteria = criteria.filter((c) => !c.id || !c.name);
    if (invalidCriteria.length > 0) {
      toast({
        title: 'Error',
        description: 'All criteria must have an ID and name',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate IDs
    const ids = criteria.map((c) => c.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      toast({
        title: 'Error',
        description: `Duplicate criterion IDs found: ${duplicates.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let result;
      if (template) {
        result = await updateAuditTemplate(template.id, {
          name,
          description: description || undefined,
          is_default: isDefault,
          criteria,
        });
      } else {
        result = await createAuditTemplate({
          name,
          description: description || undefined,
          is_default: isDefault,
          criteria,
        });
      }

      if (result.error) {
        throw result.error;
      }

      toast({
        title: 'Success',
        description: template ? 'Template updated successfully' : 'Template created successfully',
      });

      onSave(result.template!);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save template',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col bg-[var(--color-surface)] border-[var(--color-border)]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-[var(--color-text)]">
            {template ? 'Edit Audit Template' : 'Create New Audit Template'}
          </DialogTitle>
          <DialogDescription className="text-[var(--color-subtext)]">
            Define the criteria that will be used to audit calls.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full pr-4">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--color-text)]">Template Name *</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., TLC Collections Audit"
                    className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[var(--color-text)]">Set as Default</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={isDefault}
                      onCheckedChange={setIsDefault}
                    />
                    <span className="text-sm text-[var(--color-subtext)]">
                      {isDefault ? 'This template will be used for new audits' : 'Not the default template'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--color-text)]">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose of this audit template..."
                  rows={2}
                  className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
                />
              </div>
            </div>

            <Separator className="bg-[var(--color-border)]" />

            {/* Criteria */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">
                    Audit Criteria
                  </h3>
                  <p className="text-sm text-[var(--color-subtext)]">
                    {criteria.length} criteria defined
                  </p>
                </div>
                <Button
                  onClick={addCriterion}
                  className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Criterion
                </Button>
              </div>

              {criteria.length === 0 ? (
                <div className="border border-dashed border-[var(--color-border)] rounded-lg p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-subtext)]">
                    No criteria added yet. Click "Add Criterion" to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {criteria.map((criterion, index) => (
                    <CriterionEditor
                      key={`${criterion.id}-${index}`}
                      criterion={criterion}
                      index={index}
                      onChange={(updated) => updateCriterion(index, updated)}
                      onDelete={() => deleteCriterion(index)}
                      onMoveUp={() => moveCriterion(index, 'up')}
                      onMoveDown={() => moveCriterion(index, 'down')}
                      canMoveUp={index > 0}
                      canMoveDown={index < criteria.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-[var(--color-border)] pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[var(--color-border)] text-[var(--color-text)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {template ? 'Update Template' : 'Create Template'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main Audit Template Editor Component
export const AuditTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<AuditTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AuditTemplate | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<AuditTemplate | null>(null);
  const { toast } = useToast();

  const fetchTemplates = async () => {
    setLoading(true);
    const { templates: data, error } = await getAuditTemplates();
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load audit templates',
        variant: 'destructive',
      });
    }
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (template: AuditTemplate) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDelete = async (template: AuditTemplate) => {
    const { error } = await deleteAuditTemplate(template.id);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      });
      fetchTemplates();
    }
    setDeleteConfirm(null);
  };

  const handleDuplicate = async () => {
    if (!duplicatingTemplate || !duplicateName.trim()) return;

    const { error } = await duplicateAuditTemplate(duplicatingTemplate.id, duplicateName);
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to duplicate template',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: 'Template duplicated successfully',
      });
      fetchTemplates();
    }
    setDuplicatingTemplate(null);
    setDuplicateName('');
  };

  const handleSave = () => {
    fetchTemplates();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            Audit Templates
          </h1>
          <p className="text-sm text-[var(--color-subtext)] mt-1">
            Manage the criteria templates used for call auditing
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Audit Templates"
          description="Create your first audit template to start auditing calls."
          action={{
            label: 'Create Template',
            onClick: handleCreate,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              className="bg-[var(--color-surface)] border-[var(--color-border)]"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg text-[var(--color-text)]">
                        {template.name}
                      </CardTitle>
                      {template.is_default && (
                        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription className="text-[var(--color-subtext)]">
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {getAvailableDimensions().map((dim) => {
                      const count = template.criteria.filter(
                        (c) => c.dimension === dim.value
                      ).length;
                      if (count === 0) return null;
                      return (
                        <Badge
                          key={dim.value}
                          className={cn('text-xs', getDimensionColor(dim.value))}
                        >
                          {dim.label}: {count}
                        </Badge>
                      );
                    })}
                  </div>

                  <div className="text-sm text-[var(--color-subtext)]">
                    {template.criteria.length} criteria •{' '}
                    Updated {new Date(template.updated_at).toLocaleDateString()}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      className="flex-1 border-[var(--color-border)] text-[var(--color-text)]"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDuplicatingTemplate(template);
                        setDuplicateName(`${template.name} (Copy)`);
                      }}
                      className="border-[var(--color-border)] text-[var(--color-text)]"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteConfirm(template)}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/20"
                      disabled={template.is_default}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <TemplateEditorDialog
        template={editingTemplate}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--color-text)]">
              Delete Audit Template
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--color-subtext)]">
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--color-border)] text-[var(--color-text)]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <Dialog open={!!duplicatingTemplate} onOpenChange={() => setDuplicatingTemplate(null)}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Duplicate Template</DialogTitle>
            <DialogDescription className="text-[var(--color-subtext)]">
              Create a copy of "{duplicatingTemplate?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[var(--color-text)]">New Template Name</Label>
              <Input
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter a name for the copy"
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicatingTemplate(null)}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
