import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { ConversationIntelligenceService, ScriptTemplate, ScriptPhrase } from '@/services/ConversationIntelligenceService';
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  GripVertical,
  MessageSquare,
  ShieldCheck,
  Handshake,
  HelpCircle,
  Phone,
  Scale,
  BookOpen,
  Copy,
  Upload,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  opening: {
    label: 'Opening',
    icon: <Phone className="h-4 w-4" />,
    color: 'bg-blue-500',
    description: 'Call opening and introduction'
  },
  verification: {
    label: 'Verification',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'bg-green-500',
    description: 'Identity and account verification'
  },
  negotiation: {
    label: 'Negotiation',
    icon: <Handshake className="h-4 w-4" />,
    color: 'bg-purple-500',
    description: 'Payment negotiation scripts'
  },
  objection_handling: {
    label: 'Objection Handling',
    icon: <HelpCircle className="h-4 w-4" />,
    color: 'bg-orange-500',
    description: 'Handling customer objections'
  },
  closing: {
    label: 'Closing',
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-cyan-500',
    description: 'Call closing and wrap-up'
  },
  compliance: {
    label: 'Compliance',
    icon: <Scale className="h-4 w-4" />,
    color: 'bg-red-500',
    description: 'Legal and compliance requirements'
  },
  full_call: {
    label: 'Full Call',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'bg-gray-700',
    description: 'Complete call script'
  },
};

export function ScriptTemplateEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ScriptTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<ScriptTemplate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'opening' as ScriptTemplate['category'],
    script_content: '',
    required_phrases: [] as ScriptPhrase[],
    min_adherence_score: 70,
    is_active: true,
  });

  // New phrase form
  const [newPhrase, setNewPhrase] = useState({
    phrase: '',
    required: true,
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['script-templates'],
    queryFn: () => ConversationIntelligenceService.getScriptTemplates(false),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<ScriptTemplate>) =>
      ConversationIntelligenceService.createScriptTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-templates'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Script template created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ScriptTemplate> }) =>
      ConversationIntelligenceService.updateScriptTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-templates'] });
      setEditingTemplate(null);
      resetForm();
      toast({ title: 'Script template updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update template', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ConversationIntelligenceService.deleteScriptTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['script-templates'] });
      toast({ title: 'Script template deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete template', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'opening',
      script_content: '',
      required_phrases: [],
      min_adherence_score: 70,
      is_active: true,
    });
    setNewPhrase({ phrase: '', required: true });
  };

  const handleEdit = (template: ScriptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      category: template.category,
      script_content: template.script_content,
      required_phrases: template.required_phrases,
      min_adherence_score: template.min_adherence_score,
      is_active: template.is_active,
    });
  };

  const handleSubmit = () => {
    const data: Partial<ScriptTemplate> = {
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category,
      script_content: formData.script_content,
      required_phrases: formData.required_phrases,
      min_adherence_score: formData.min_adherence_score,
      is_active: formData.is_active,
    };

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddPhrase = () => {
    if (!newPhrase.phrase.trim()) return;
    const updatedPhrases = [
      ...formData.required_phrases,
      {
        phrase: newPhrase.phrase.trim(),
        required: newPhrase.required,
        order: formData.required_phrases.length,
      },
    ];
    setFormData({ ...formData, required_phrases: updatedPhrases });
    setNewPhrase({ phrase: '', required: true });
  };

  const handleRemovePhrase = (index: number) => {
    const updatedPhrases = formData.required_phrases.filter((_, i) => i !== index);
    setFormData({ ...formData, required_phrases: updatedPhrases });
  };

  const handleToggleActive = (template: ScriptTemplate) => {
    updateMutation.mutate({
      id: template.id,
      data: { is_active: !template.is_active },
    });
  };

  const handleDuplicate = (template: ScriptTemplate) => {
    createMutation.mutate({
      name: `${template.name} (Copy)`,
      description: template.description,
      category: template.category,
      script_content: template.script_content,
      required_phrases: template.required_phrases,
      min_adherence_score: template.min_adherence_score,
      is_active: false, // Start as inactive
    });
  };

  // Export templates as JSON
  const handleExportJSON = () => {
    const exportData = templates.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      script_content: t.script_content,
      required_phrases: t.required_phrases,
      min_adherence_score: t.min_adherence_score,
      is_active: t.is_active,
    }));
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-templates-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${templates.length} script templates exported` });
  };

  // Import from JSON file
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        const templatesArray = Array.isArray(imported) ? imported : [imported];

        let successCount = 0;
        for (const template of templatesArray) {
          try {
            await ConversationIntelligenceService.createScriptTemplate({
              name: template.name,
              description: template.description,
              category: template.category,
              script_content: template.script_content,
              required_phrases: template.required_phrases || [],
              min_adherence_score: template.min_adherence_score || 70,
              is_active: false, // Import as inactive by default
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to import template: ${template.name}`, err);
          }
        }

        queryClient.invalidateQueries({ queryKey: ['script-templates'] });
        toast({
          title: 'Import Complete',
          description: `${successCount} of ${templatesArray.length} templates imported`
        });
      } catch (err) {
        toast({
          title: 'Import Failed',
          description: 'Invalid JSON format',
          variant: 'destructive'
        });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Group templates by category
  const templatesByCategory = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, ScriptTemplate[]>);

  return (
    <div className="space-y-6">
      {/* Hidden file input for import */}
      <input
        type="file"
        accept=".json"
        className="hidden"
        id="script-import-input"
        onChange={handleImportJSON}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Script Templates</h2>
          <p className="text-muted-foreground">
            Create and manage script templates for adherence checking
          </p>
        </div>
        <div className="flex gap-2">
          {/* Import/Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import/Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => document.getElementById('script-import-input')?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import from JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportJSON}>
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        <Dialog open={isCreateDialogOpen || !!editingTemplate} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? 'Edit Script Template' : 'Create Script Template'}</DialogTitle>
              <DialogDescription>
                Define the script content and required phrases for adherence checking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Mini-Miranda Script"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when this script should be used..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="script_content">Script Content</Label>
                <Textarea
                  id="script_content"
                  value={formData.script_content}
                  onChange={(e) => setFormData({ ...formData, script_content: e.target.value })}
                  placeholder="Enter the full script content here..."
                  className="min-h-[150px] font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Minimum Adherence Score: {formData.min_adherence_score}%</Label>
                <Slider
                  value={[formData.min_adherence_score]}
                  onValueChange={(value) => setFormData({ ...formData, min_adherence_score: value[0] })}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Calls scoring below this threshold will trigger an alert
                </p>
              </div>

              <div className="space-y-3">
                <Label>Required Phrases</Label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      placeholder="Enter a required phrase..."
                      value={newPhrase.phrase}
                      onChange={(e) => setNewPhrase({ ...newPhrase, phrase: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newPhrase.required}
                      onCheckedChange={(checked) => setNewPhrase({ ...newPhrase, required: checked })}
                    />
                    <Label className="text-sm whitespace-nowrap">Required</Label>
                  </div>
                  <Button onClick={handleAddPhrase} disabled={!newPhrase.phrase.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {formData.required_phrases.map((phrase, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{phrase.phrase}</span>
                      <Badge variant={phrase.required ? 'default' : 'secondary'}>
                        {phrase.required ? 'Required' : 'Optional'}
                      </Badge>
                      <Button variant="ghost" size="icon" onClick={() => handleRemovePhrase(idx)}>
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                  {formData.required_phrases.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No required phrases added yet
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || !formData.script_content.trim()}
              >
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4">
        {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
          const categoryTemplates = templatesByCategory[category] || [];
          if (categoryTemplates.length === 0) return null;

          return (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg text-white ${config.color}`}>
                    {config.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold">{config.label}</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid gap-3">
                  {categoryTemplates.map((template) => (
                    <Card key={template.id} className={template.is_active ? '' : 'opacity-60'}>
                      <CardHeader className="py-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {template.name}
                              {!template.is_active && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </CardTitle>
                            {template.description && (
                              <CardDescription className="mt-1">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingTemplate(template)}
                            >
                              View
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(template)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDuplicate(template)}
                              title="Duplicate template"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pb-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {template.required_phrases.filter(p => p.required).length} required phrases
                          </span>
                          <span>•</span>
                          <span>Min score: {template.min_adherence_score}%</span>
                          <div className="flex-1" />
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={() => handleToggleActive(template)}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {templates.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No script templates yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first script template to start tracking adherence.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* View Template Dialog */}
      <Dialog open={!!viewingTemplate} onOpenChange={() => setViewingTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingTemplate?.name}</DialogTitle>
            <DialogDescription>{viewingTemplate?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Script Content</Label>
              <pre className="mt-2 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap font-mono">
                {viewingTemplate?.script_content}
              </pre>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Required Phrases</Label>
              <div className="mt-2 space-y-2">
                {viewingTemplate?.required_phrases.map((phrase, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {phrase.required ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-muted-foreground" />
                    )}
                    <span className="text-sm">{phrase.phrase}</span>
                    <Badge variant={phrase.required ? 'default' : 'secondary'} className="ml-auto">
                      {phrase.required ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
