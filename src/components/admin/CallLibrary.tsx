import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Search,
  Filter,
  Star,
  StarOff,
  Tag,
  Clock,
  User,
  Play,
  Pause,
  Download,
  Share2,
  MessageSquare,
  BarChart3,
  Plus,
  X,
  Bookmark,
  BookmarkCheck,
  Folder,
  FolderOpen,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Call {
  id: string;
  call_date: string;
  duration_seconds: number;
  agent_name: string;
  disposition: string;
  direction: string;
  phone_number: string;
  status: string;
  recording_url?: string;
  transcript?: string;
  user_id: string;
  created_at: string;
  agent?: { first_name: string; last_name: string; team?: string };
  report_cards?: { id: string; overall_score: number; compliance_score: number }[];
  conversation_analyses?: { id: string; sentiment: any; compliance_score: number }[];
  call_tags?: { id: string; tag: { id: string; name: string; color: string } }[];
  is_bookmarked?: boolean;
  notes?: string;
}

interface CallTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  usage_count?: number;
}

interface CallCollection {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  created_by: string;
  call_count?: number;
}

const TAG_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
];

const getScoreColor = (score: number | null): string => {
  if (score === null || score === undefined) return 'text-gray-500';
  if (score >= 90) return 'text-green-500';
  if (score >= 80) return 'text-lime-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 60) return 'text-orange-500';
  return 'text-red-500';
};

export const CallLibrary = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [tags, setTags] = useState<CallTag[]>([]);
  const [collections, setCollections] = useState<CallCollection[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterDisposition, setFilterDisposition] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [dispositions, setDispositions] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch calls with related data
      const { data: callsData, error: callsError } = await supabase
        .from('calls')
        .select(`
          *,
          agent:user_id (first_name, last_name, team),
          report_cards (id, overall_score, compliance_score),
          conversation_analyses (id, sentiment, compliance_score),
          call_tags (id, tag:tag_id (id, name, color))
        `)
        .order('call_date', { ascending: false })
        .limit(200);

      if (callsError) throw callsError;
      setCalls(callsData || []);

      // Extract unique agents and dispositions
      const uniqueAgents = new Map<string, string>();
      const uniqueDispositions = new Set<string>();
      (callsData || []).forEach((call: Call) => {
        if (call.agent_name) {
          uniqueAgents.set(call.user_id, call.agent_name);
        }
        if (call.disposition) {
          uniqueDispositions.add(call.disposition);
        }
      });
      setAgents(Array.from(uniqueAgents.entries()).map(([id, name]) => ({ id, name })));
      setDispositions(Array.from(uniqueDispositions));

      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('call_tags_master')
        .select('*')
        .order('name');

      if (!tagsError) {
        setTags(tagsData || []);
      }

      // Fetch collections
      const { data: collectionsData, error: collectionsError } = await supabase
        .from('call_collections')
        .select('*')
        .order('name');

      if (!collectionsError) {
        setCollections(collectionsData || []);
      }
    } catch (error) {
      console.error('Error fetching call library data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load call library',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleBookmark = async (callId: string) => {
    const call = calls.find((c) => c.id === callId);
    if (!call) return;

    const newBookmarkStatus = !call.is_bookmarked;

    setCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, is_bookmarked: newBookmarkStatus } : c))
    );

    try {
      await supabase
        .from('calls')
        .update({ is_bookmarked: newBookmarkStatus })
        .eq('id', callId);

      toast({
        title: newBookmarkStatus ? 'Bookmarked' : 'Removed',
        description: newBookmarkStatus ? 'Call added to bookmarks' : 'Call removed from bookmarks',
      });
    } catch (error) {
      // Revert on error
      setCalls((prev) =>
        prev.map((c) => (c.id === callId ? { ...c, is_bookmarked: !newBookmarkStatus } : c))
      );
    }
  };

  const addTagToCall = async (callId: string, tagId: string) => {
    try {
      await supabase
        .from('call_tags')
        .insert({ call_id: callId, tag_id: tagId });

      fetchData();
      toast({
        title: 'Tag Added',
        description: 'Tag has been added to the call',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add tag',
        variant: 'destructive',
      });
    }
  };

  const removeTagFromCall = async (callTagId: string) => {
    try {
      await supabase
        .from('call_tags')
        .delete()
        .eq('id', callTagId);

      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove tag',
        variant: 'destructive',
      });
    }
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;

    try {
      await supabase
        .from('call_tags_master')
        .insert({ name: newTagName.trim(), color: newTagColor });

      setNewTagName('');
      setNewTagColor('blue');
      setShowTagDialog(false);
      fetchData();
      toast({
        title: 'Tag Created',
        description: `Tag "${newTagName}" has been created`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create tag',
        variant: 'destructive',
      });
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('call_collections')
        .insert({
          name: newCollectionName.trim(),
          description: newCollectionDesc.trim(),
          created_by: user?.id,
          is_public: false,
        });

      setNewCollectionName('');
      setNewCollectionDesc('');
      setShowCollectionDialog(false);
      fetchData();
      toast({
        title: 'Collection Created',
        description: `Collection "${newCollectionName}" has been created`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create collection',
        variant: 'destructive',
      });
    }
  };

  // Filter calls
  const filteredCalls = calls.filter((call) => {
    if (showBookmarked && !call.is_bookmarked) return false;
    if (filterAgent !== 'all' && call.user_id !== filterAgent) return false;
    if (filterDisposition !== 'all' && call.disposition !== filterDisposition) return false;

    // Score filter
    if (filterScore !== 'all') {
      const score = call.report_cards?.[0]?.overall_score;
      if (filterScore === 'high' && (score === undefined || score < 90)) return false;
      if (filterScore === 'medium' && (score === undefined || score < 70 || score >= 90)) return false;
      if (filterScore === 'low' && (score === undefined || score >= 70)) return false;
    }

    // Tag filter
    if (filterTags.length > 0) {
      const callTagIds = call.call_tags?.map((ct) => ct.tag?.id) || [];
      if (!filterTags.some((tagId) => callTagIds.includes(tagId))) return false;
    }

    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        call.agent_name?.toLowerCase().includes(search) ||
        call.phone_number?.toLowerCase().includes(search) ||
        call.disposition?.toLowerCase().includes(search) ||
        call.transcript?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Stats
  const stats = {
    totalCalls: calls.length,
    bookmarked: calls.filter((c) => c.is_bookmarked).length,
    avgScore: calls.filter((c) => c.report_cards?.[0]?.overall_score).length
      ? Math.round(
          calls
            .filter((c) => c.report_cards?.[0]?.overall_score)
            .reduce((acc, c) => acc + (c.report_cards?.[0]?.overall_score || 0), 0) /
            calls.filter((c) => c.report_cards?.[0]?.overall_score).length
        )
      : 0,
    withTranscript: calls.filter((c) => c.transcript).length,
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
            <Phone className="h-6 w-6 text-[var(--color-accent)]" />
            Call Library
          </h1>
          <p className="text-[var(--color-subtext)]">Browse, search, and organize calls for training & review</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTagDialog(true)}>
            <Tag className="h-4 w-4 mr-2" />
            Manage Tags
          </Button>
          <Button variant="outline" onClick={() => setShowCollectionDialog(true)}>
            <FolderOpen className="h-4 w-4 mr-2" />
            New Collection
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Total Calls</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.totalCalls}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Bookmark className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Bookmarked</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.bookmarked}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Avg Score</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${getScoreColor(stats.avgScore)}`}>{stats.avgScore}%</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">With Transcript</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.withTranscript}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-subtext)]" />
                <Input
                  placeholder="Search calls, agents, transcripts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-[var(--color-bg)] border-[var(--color-border)]"
                />
              </div>
            </div>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-40 bg-[var(--color-bg)] border-[var(--color-border)]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterDisposition} onValueChange={setFilterDisposition}>
              <SelectTrigger className="w-40 bg-[var(--color-bg)] border-[var(--color-border)]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Disposition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dispositions</SelectItem>
                {dispositions.map((disp) => (
                  <SelectItem key={disp} value={disp}>
                    {disp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterScore} onValueChange={setFilterScore}>
              <SelectTrigger className="w-40 bg-[var(--color-bg)] border-[var(--color-border)]">
                <BarChart3 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="high">High (90+)</SelectItem>
                <SelectItem value="medium">Medium (70-89)</SelectItem>
                <SelectItem value="low">Low (&lt;70)</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showBookmarked ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowBookmarked(!showBookmarked)}
            >
              {showBookmarked ? <BookmarkCheck className="h-4 w-4 mr-1" /> : <Bookmark className="h-4 w-4 mr-1" />}
              Bookmarked
            </Button>
          </div>

          {/* Tag Filters */}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-subtext)]">Tags:</span>
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={filterTags.includes(tag.id) ? 'default' : 'outline'}
                  className={`cursor-pointer ${filterTags.includes(tag.id) ? 'bg-' + tag.color + '-500' : ''}`}
                  onClick={() => {
                    setFilterTags((prev) =>
                      prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]
                    );
                  }}
                >
                  <span className={`w-2 h-2 rounded-full mr-1 bg-${tag.color}-500`} />
                  {tag.name}
                </Badge>
              ))}
              {filterTags.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFilterTags([])}>
                  Clear
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Call List */}
        <div className="lg:col-span-3">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-text)]">
                Calls ({filteredCalls.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredCalls.map((call) => {
                  const score = call.report_cards?.[0]?.overall_score;
                  const complianceScore = call.report_cards?.[0]?.compliance_score;
                  const sentiment = call.conversation_analyses?.[0]?.sentiment;

                  return (
                    <div
                      key={call.id}
                      className={`p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface)] transition-colors ${
                        selectedCall?.id === call.id ? 'ring-2 ring-[var(--color-accent)]' : ''
                      }`}
                      onClick={() => setSelectedCall(call)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-[var(--color-surface)]">
                            <Phone className="h-4 w-4 text-[var(--color-accent)]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-[var(--color-text)]">{call.agent_name}</p>
                              {call.is_bookmarked && (
                                <Bookmark className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-subtext)]">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(call.call_date).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {Math.floor((call.duration_seconds || 0) / 60)}m {(call.duration_seconds || 0) % 60}s
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {call.disposition || 'Unknown'}
                              </Badge>
                            </div>
                            {/* Tags */}
                            {call.call_tags && call.call_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {call.call_tags.map((ct) => (
                                  <Badge
                                    key={ct.id}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    <span className={`w-2 h-2 rounded-full mr-1 bg-${ct.tag?.color || 'gray'}-500`} />
                                    {ct.tag?.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {score !== undefined && (
                            <div className="text-right">
                              <p className="text-xs text-[var(--color-subtext)]">Score</p>
                              <p className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</p>
                            </div>
                          )}
                          {sentiment && (
                            <Badge variant={
                              sentiment.overall === 'positive' ? 'default' :
                              sentiment.overall === 'negative' ? 'destructive' : 'secondary'
                            }>
                              {sentiment.overall}
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBookmark(call.id);
                            }}
                          >
                            {call.is_bookmarked ? (
                              <Bookmark className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredCalls.length === 0 && (
                  <div className="text-center py-12">
                    <Phone className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-3" />
                    <p className="text-[var(--color-text)] font-medium">No calls found</p>
                    <p className="text-sm text-[var(--color-subtext)]">Try adjusting your filters</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Collections & Selected Call */}
        <div className="space-y-6">
          {/* Collections */}
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-text)] text-sm flex items-center gap-2">
                <Folder className="h-4 w-4" />
                Collections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between p-2 rounded bg-[var(--color-bg)] cursor-pointer hover:bg-[var(--color-surface)]"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-[var(--color-accent)]" />
                      <span className="text-sm text-[var(--color-text)]">{collection.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {collection.call_count || 0}
                    </Badge>
                  </div>
                ))}
                {collections.length === 0 && (
                  <p className="text-center text-[var(--color-subtext)] text-sm py-4">
                    No collections yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Selected Call Details */}
          {selectedCall && (
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
              <CardHeader>
                <CardTitle className="text-[var(--color-text)] text-sm">Call Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Agent</p>
                  <p className="font-medium text-[var(--color-text)]">{selectedCall.agent_name}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Date & Time</p>
                  <p className="text-[var(--color-text)]">
                    {new Date(selectedCall.call_date).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Duration</p>
                  <p className="text-[var(--color-text)]">
                    {Math.floor((selectedCall.duration_seconds || 0) / 60)}m {(selectedCall.duration_seconds || 0) % 60}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Disposition</p>
                  <Badge variant="secondary">{selectedCall.disposition || 'Unknown'}</Badge>
                </div>

                {selectedCall.report_cards?.[0] && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-subtext)] mb-2">Scores</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text)]">Overall</span>
                        <span className={`font-bold ${getScoreColor(selectedCall.report_cards[0].overall_score)}`}>
                          {selectedCall.report_cards[0].overall_score}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text)]">Compliance</span>
                        <span className={`font-bold ${getScoreColor(selectedCall.report_cards[0].compliance_score)}`}>
                          {selectedCall.report_cards[0].compliance_score}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Tag */}
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-subtext)] mb-2">Add Tag</p>
                  <div className="flex flex-wrap gap-1">
                    {tags
                      .filter((t) => !selectedCall.call_tags?.some((ct) => ct.tag?.id === t.id))
                      .map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-[var(--color-bg)]"
                          onClick={() => addTagToCall(selectedCall.id, tag.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tag.name}
                        </Badge>
                      ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-[var(--color-border)] flex flex-wrap gap-2">
                  {selectedCall.recording_url && (
                    <Button size="sm" variant="outline">
                      <Play className="h-3 w-3 mr-1" />
                      Play
                    </Button>
                  )}
                  {selectedCall.transcript && (
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Transcript
                    </Button>
                  )}
                  <Button size="sm" variant="outline">
                    <Share2 className="h-3 w-3 mr-1" />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Create New Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[var(--color-text)]">Tag Name</Label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="e.g., Training Example"
                className="mt-1 bg-[var(--color-bg)] border-[var(--color-border)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Color</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full ${color.class} ${
                      newTagColor === color.value ? 'ring-2 ring-offset-2 ring-[var(--color-accent)]' : ''
                    }`}
                    onClick={() => setNewTagColor(color.value)}
                  />
                ))}
              </div>
            </div>

            {/* Existing Tags */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <Label className="text-[var(--color-text)]">Existing Tags</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    <span className={`w-2 h-2 rounded-full mr-1 bg-${tag.color}-500`} />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createTag} disabled={!newTagName.trim()}>
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Collection Dialog */}
      <Dialog open={showCollectionDialog} onOpenChange={setShowCollectionDialog}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-[var(--color-text)]">Collection Name</Label>
              <Input
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g., Best Practices"
                className="mt-1 bg-[var(--color-bg)] border-[var(--color-border)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Description</Label>
              <Textarea
                value={newCollectionDesc}
                onChange={(e) => setNewCollectionDesc(e.target.value)}
                placeholder="Optional description..."
                className="mt-1 bg-[var(--color-bg)] border-[var(--color-border)]"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollectionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createCollection} disabled={!newCollectionName.trim()}>
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
