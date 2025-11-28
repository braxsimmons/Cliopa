import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ConversationIntelligenceService, KeywordLibrary, KeywordEntry } from '@/services/ConversationIntelligenceService';
import {
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  MessageSquare,
  Heart,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
  XCircle,
  Book,
} from 'lucide-react';

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  compliance: { label: 'Compliance', icon: <ShieldAlert className="h-4 w-4" />, color: 'bg-blue-500' },
  prohibited: { label: 'Prohibited', icon: <XCircle className="h-4 w-4" />, color: 'bg-red-500' },
  empathy: { label: 'Empathy', icon: <Heart className="h-4 w-4" />, color: 'bg-pink-500' },
  escalation: { label: 'Escalation', icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-orange-500' },
  sales: { label: 'Sales', icon: <TrendingUp className="h-4 w-4" />, color: 'bg-green-500' },
  closing: { label: 'Closing', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-purple-500' },
  greeting: { label: 'Greeting', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-cyan-500' },
  custom: { label: 'Custom', icon: <Book className="h-4 w-4" />, color: 'bg-gray-500' },
};

export function KeywordLibraryManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<KeywordLibrary | null>(null);
  const [isKeywordDialogOpen, setIsKeywordDialogOpen] = useState(false);
  const [selectedLibrary, setSelectedLibrary] = useState<KeywordLibrary | null>(null);

  // Form state for new/edit library
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'custom' as KeywordLibrary['category'],
    is_active: true,
  });

  // Form state for new keyword
  const [newKeyword, setNewKeyword] = useState({
    phrase: '',
    weight: 5,
    exact_match: false,
  });

  // Fetch libraries
  const { data: libraries = [], isLoading } = useQuery({
    queryKey: ['keyword-libraries'],
    queryFn: () => ConversationIntelligenceService.getKeywordLibraries(false),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<KeywordLibrary>) =>
      ConversationIntelligenceService.createKeywordLibrary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-libraries'] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: 'Library created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create library', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KeywordLibrary> }) =>
      ConversationIntelligenceService.updateKeywordLibrary(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-libraries'] });
      setEditingLibrary(null);
      resetForm();
      toast({ title: 'Library updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update library', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => ConversationIntelligenceService.deleteKeywordLibrary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-libraries'] });
      toast({ title: 'Library deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete library', description: error.message, variant: 'destructive' });
    },
  });

  // Add keyword mutation
  const addKeywordMutation = useMutation({
    mutationFn: ({ libraryId, keyword }: { libraryId: string; keyword: KeywordEntry }) =>
      ConversationIntelligenceService.addKeywordToLibrary(libraryId, keyword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-libraries'] });
      setNewKeyword({ phrase: '', weight: 5, exact_match: false });
      toast({ title: 'Keyword added successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add keyword', description: error.message, variant: 'destructive' });
    },
  });

  // Remove keyword mutation
  const removeKeywordMutation = useMutation({
    mutationFn: ({ libraryId, phrase }: { libraryId: string; phrase: string }) =>
      ConversationIntelligenceService.removeKeywordFromLibrary(libraryId, phrase),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-libraries'] });
      toast({ title: 'Keyword removed successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to remove keyword', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', category: 'custom', is_active: true });
  };

  const handleEdit = (library: KeywordLibrary) => {
    setEditingLibrary(library);
    setFormData({
      name: library.name,
      description: library.description || '',
      category: library.category,
      is_active: library.is_active,
    });
  };

  const handleSubmit = () => {
    const data: Partial<KeywordLibrary> = {
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category,
      is_active: formData.is_active,
      keywords: editingLibrary?.keywords || [],
    };

    if (editingLibrary) {
      updateMutation.mutate({ id: editingLibrary.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleAddKeyword = () => {
    if (!selectedLibrary || !newKeyword.phrase.trim()) return;
    addKeywordMutation.mutate({
      libraryId: selectedLibrary.id,
      keyword: {
        phrase: newKeyword.phrase.trim(),
        weight: newKeyword.weight,
        exact_match: newKeyword.exact_match,
      },
    });
  };

  const handleToggleActive = (library: KeywordLibrary) => {
    updateMutation.mutate({
      id: library.id,
      data: { is_active: !library.is_active },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Keyword Libraries</h2>
          <p className="text-muted-foreground">
            Manage keyword detection libraries for conversation analysis
          </p>
        </div>
        <Dialog open={isCreateDialogOpen || !!editingLibrary} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingLibrary(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Library
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLibrary ? 'Edit Library' : 'Create Keyword Library'}</DialogTitle>
              <DialogDescription>
                {editingLibrary
                  ? 'Update the library details below.'
                  : 'Create a new keyword library for detecting specific phrases in calls.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Payment Keywords"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the purpose of this library..."
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
                  setEditingLibrary(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
                {editingLibrary ? 'Save Changes' : 'Create Library'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {libraries.map((library) => {
          const config = CATEGORY_CONFIG[library.category] || CATEGORY_CONFIG.custom;
          return (
            <Card key={library.id} className={library.is_active ? '' : 'opacity-60'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg text-white ${config.color}`}>
                      {config.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{library.name}</CardTitle>
                      <Badge variant={library.is_active ? 'default' : 'secondary'} className="mt-1">
                        {library.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(library)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(library.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                {library.description && (
                  <CardDescription className="mt-2">{library.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">
                    {library.keywords.length} keywords
                  </span>
                  <Switch
                    checked={library.is_active}
                    onCheckedChange={() => handleToggleActive(library)}
                  />
                </div>
                <div className="flex flex-wrap gap-1 mb-3 max-h-20 overflow-y-auto">
                  {library.keywords.slice(0, 8).map((kw, idx) => (
                    <Badge
                      key={idx}
                      variant={kw.weight >= 0 ? 'outline' : 'destructive'}
                      className="text-xs"
                    >
                      {kw.phrase}
                      <span className="ml-1 opacity-70">({kw.weight > 0 ? '+' : ''}{kw.weight})</span>
                    </Badge>
                  ))}
                  {library.keywords.length > 8 && (
                    <Badge variant="secondary" className="text-xs">
                      +{library.keywords.length - 8} more
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedLibrary(library);
                    setIsKeywordDialogOpen(true);
                  }}
                >
                  Manage Keywords
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Keyword Management Dialog */}
      <Dialog open={isKeywordDialogOpen} onOpenChange={setIsKeywordDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Keywords - {selectedLibrary?.name}</DialogTitle>
            <DialogDescription>
              Add or remove keywords from this library. Positive weights increase scores,
              negative weights decrease scores.
            </DialogDescription>
          </DialogHeader>

          {/* Add new keyword form */}
          <div className="flex gap-2 items-end border-b pb-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="phrase">Phrase</Label>
              <Input
                id="phrase"
                placeholder="Enter keyword or phrase..."
                value={newKeyword.phrase}
                onChange={(e) => setNewKeyword({ ...newKeyword, phrase: e.target.value })}
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                value={newKeyword.weight}
                onChange={(e) => setNewKeyword({ ...newKeyword, weight: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="exact"
                checked={newKeyword.exact_match}
                onCheckedChange={(checked) => setNewKeyword({ ...newKeyword, exact_match: checked })}
              />
              <Label htmlFor="exact" className="text-sm">Exact</Label>
            </div>
            <Button onClick={handleAddKeyword} disabled={!newKeyword.phrase.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Keywords table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phrase</TableHead>
                <TableHead className="w-24">Weight</TableHead>
                <TableHead className="w-24">Exact</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedLibrary?.keywords.map((keyword, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{keyword.phrase}</TableCell>
                  <TableCell>
                    <Badge variant={keyword.weight >= 0 ? 'default' : 'destructive'}>
                      {keyword.weight > 0 ? '+' : ''}{keyword.weight}
                    </Badge>
                  </TableCell>
                  <TableCell>{keyword.exact_match ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        removeKeywordMutation.mutate({
                          libraryId: selectedLibrary.id,
                          phrase: keyword.phrase,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {selectedLibrary?.keywords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No keywords yet. Add some above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
