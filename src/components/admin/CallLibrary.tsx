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
  Loader2,
  Zap,
  RefreshCw,
  FileText,
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
import { ReportCardViewer } from './ReportCardViewer';
import { callIngestionService } from '@/services/CallIngestionService';

interface Call {
  id: string;
  call_id: string;
  call_start_time: string;
  call_end_time?: string;
  call_duration_seconds: number;
  campaign_name?: string;
  call_type?: string;
  disposition?: string;
  customer_phone?: string;
  customer_name?: string;
  status: string;
  recording_url?: string;
  transcript_text?: string;
  user_id: string;
  created_at: string;
  report_cards?: { id: string; overall_score: number; compliance_score: number }[];
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

const LOCAL_API_URL = import.meta.env.VITE_LOCAL_API_URL || "";

interface ProcessingStatus {
  isProcessing: boolean;
  currentCallId?: string;
  currentStep?: string;
  processed: number;
  total: number;
  successful: number;
  failed: number;
}

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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [viewingReportCard, setViewingReportCard] = useState<{ callId?: string; reportCardId?: string } | null>(null);
  const [processingCall, setProcessingCall] = useState<string | null>(null);
  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set());

  // Poll for processing status every 3 seconds (only if local API is configured)
  useEffect(() => {
    if (!LOCAL_API_URL) {
      setServerAvailable(false);
      setProcessingStatus(null);
      return;
    }

    const checkProcessingStatus = async () => {
      try {
        const response = await fetch(`${LOCAL_API_URL}/api/status`);
        if (response.ok) {
          const status = await response.json();
          setProcessingStatus(status);
          setServerAvailable(true);

          // If processing just finished, refresh the call list
          if (processingStatus?.isProcessing && !status.isProcessing) {
            fetchData();
          }
        } else {
          setServerAvailable(false);
          setProcessingStatus(null);
        }
      } catch {
        setServerAvailable(false);
        setProcessingStatus(null);
      }
    };

    checkProcessingStatus();
    const interval = setInterval(checkProcessingStatus, 3000);
    return () => clearInterval(interval);
  }, [processingStatus?.isProcessing]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch calls with report cards
      const { data: callsData, error: callsError } = await supabase
        .from('calls')
        .select(`
          *,
          report_cards (id, overall_score, compliance_score)
        `)
        .order('call_start_time', { ascending: false })
        .limit(200);

      if (callsError) {
        console.error('Calls query error:', callsError);
        // Try simpler query without joins
        const { data: simpleCalls, error: simpleError } = await supabase
          .from('calls')
          .select('*')
          .order('call_start_time', { ascending: false })
          .limit(200);

        if (simpleError) throw simpleError;
        setCalls(simpleCalls || []);
      } else {
        setCalls(callsData || []);
      }

      // Extract unique campaigns and dispositions from loaded calls
      const loadedCalls = callsData || [];
      const uniqueCampaigns = new Set<string>();
      const uniqueDispositions = new Set<string>();
      loadedCalls.forEach((call: any) => {
        if (call.campaign_name) {
          uniqueCampaigns.add(call.campaign_name);
        }
        if (call.disposition) {
          uniqueDispositions.add(call.disposition);
        }
      });
      setAgents(Array.from(uniqueCampaigns).map(name => ({ id: name, name })));
      setDispositions(Array.from(uniqueDispositions));

      // Tags and collections are optional - don't fail if they don't exist
      try {
        const { data: tagsData } = await supabase
          .from('call_tags_master')
          .select('*')
          .order('name');
        if (tagsData) setTags(tagsData);
      } catch {
        // Table might not exist
      }

      try {
        const { data: collectionsData } = await supabase
          .from('call_collections')
          .select('*')
          .order('name');
        if (collectionsData) setCollections(collectionsData);
      } catch {
        // Table might not exist
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

  // Process a single call with AI audit
  const processCall = async (callId: string) => {
    const call = calls.find(c => c.id === callId);
    if (!call || !call.transcript_text) {
      toast({
        title: 'Cannot Process',
        description: 'Call has no transcript to audit',
        variant: 'destructive',
      });
      return;
    }

    setProcessingCall(callId);
    try {
      // Trigger the audit through the ingestion service
      await callIngestionService.triggerAudit(callId);

      toast({
        title: 'Processing Started',
        description: 'AI is auditing the call. Results will appear shortly.',
      });

      // Poll for completion
      const checkCompletion = async () => {
        const { data: updatedCall } = await supabase
          .from('calls')
          .select('status, report_cards(id)')
          .eq('id', callId)
          .single();

        if (updatedCall?.status === 'audited' || updatedCall?.report_cards?.length > 0) {
          setProcessingCall(null);
          fetchData();
          toast({
            title: 'Audit Complete',
            description: 'The call has been audited successfully.',
          });
          return true;
        }
        return false;
      };

      // Check every 2 seconds for up to 60 seconds
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const done = await checkCompletion();
        if (done || attempts > 30) {
          clearInterval(interval);
          if (attempts > 30) {
            setProcessingCall(null);
            toast({
              title: 'Processing',
              description: 'Audit is taking longer than expected. Check back in a moment.',
            });
          }
        }
      }, 2000);
    } catch (error: any) {
      console.error('Process call error:', error);
      setProcessingCall(null);
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process call',
        variant: 'destructive',
      });
    }
  };

  // Process multiple selected calls
  const processSelectedCalls = async () => {
    if (selectedCalls.size === 0) {
      toast({
        title: 'No Calls Selected',
        description: 'Select calls to process by clicking on them',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Batch Processing Started',
      description: `Processing ${selectedCalls.size} calls...`,
    });

    let successful = 0;
    let failed = 0;

    for (const callId of selectedCalls) {
      try {
        await callIngestionService.triggerAudit(callId);
        successful++;
      } catch {
        failed++;
      }
    }

    setSelectedCalls(new Set());
    fetchData();

    toast({
      title: 'Batch Complete',
      description: `${successful} audited, ${failed} failed`,
    });
  };

  // Process all pending calls
  const processPendingCalls = async () => {
    const pending = calls.filter(c => c.status !== 'audited' && c.transcript_text);
    if (pending.length === 0) {
      toast({
        title: 'No Pending Calls',
        description: 'All calls with transcripts have been audited',
      });
      return;
    }

    toast({
      title: 'Processing All Pending',
      description: `Starting audit for ${pending.length} calls...`,
    });

    let processed = 0;
    for (const call of pending) {
      try {
        await callIngestionService.triggerAudit(call.id);
        processed++;
      } catch (e) {
        console.error('Failed to process:', call.id, e);
      }
    }

    fetchData();
    toast({
      title: 'Batch Complete',
      description: `Started processing ${processed} calls. Refresh to see results.`,
    });
  };

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
    // Tab-based filtering
    if (activeTab === 'audited' && call.status !== 'audited') return false;
    if (activeTab === 'pending' && call.status !== 'pending') return false;

    if (showBookmarked && !call.is_bookmarked) return false;
    if (filterAgent !== 'all' && call.campaign_name !== filterAgent) return false;
    if (filterDisposition !== 'all' && call.disposition !== filterDisposition) return false;

    // Status filter
    if (filterStatus !== 'all' && call.status !== filterStatus) return false;

    // Score filter
    if (filterScore !== 'all') {
      const score = call.report_cards?.[0]?.overall_score;
      if (filterScore === 'high' && (score === undefined || score < 90)) return false;
      if (filterScore === 'medium' && (score === undefined || score < 70 || score >= 90)) return false;
      if (filterScore === 'low' && (score === undefined || score >= 70)) return false;
    }

    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        call.campaign_name?.toLowerCase().includes(search) ||
        call.customer_phone?.toLowerCase().includes(search) ||
        call.customer_name?.toLowerCase().includes(search) ||
        call.disposition?.toLowerCase().includes(search) ||
        call.call_id?.toLowerCase().includes(search) ||
        call.transcript_text?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Stats
  const auditedCalls = calls.filter((c) => c.status === 'audited');
  const pendingCalls = calls.filter((c) => c.status === 'pending');
  const stats = {
    totalCalls: calls.length,
    audited: auditedCalls.length,
    pending: pendingCalls.length,
    avgScore: auditedCalls.length
      ? Math.round(
          auditedCalls
            .filter((c) => c.report_cards?.[0]?.overall_score)
            .reduce((acc, c) => acc + (c.report_cards?.[0]?.overall_score || 0), 0) /
            auditedCalls.filter((c) => c.report_cards?.[0]?.overall_score).length || 1
        )
      : 0,
    bookmarked: calls.filter((c) => c.is_bookmarked).length,
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
          {stats.pending > 0 && (
            <Button
              onClick={processPendingCalls}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
            >
              <Zap className="h-4 w-4 mr-2" />
              Process All Pending ({stats.pending})
            </Button>
          )}
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
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-[var(--color-subtext)]">Audited</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.audited}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-[var(--color-subtext)]">Pending Audit</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Avg Score</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${getScoreColor(stats.avgScore)}`}>{stats.avgScore || 'N/A'}{stats.avgScore ? '%' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Processing Status Banner */}
      {processingStatus?.isProcessing && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Processing Calls
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {processingStatus.currentStep || 'Initializing...'}
                    {processingStatus.currentCallId && (
                      <span className="ml-2 font-mono text-xs bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
                        Call: {processingStatus.currentCallId.slice(0, 8)}...
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {processingStatus.processed}/{processingStatus.total}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">Processed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {processingStatus.successful}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">Success</p>
                </div>
                {processingStatus.failed > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {processingStatus.failed}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300">Failed</p>
                  </div>
                )}
              </div>
            </div>
            {/* Progress bar */}
            {processingStatus.total > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-500"
                    style={{ width: `${(processingStatus.processed / processingStatus.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recently Completed Processing */}
      {!processingStatus?.isProcessing && processingStatus && (processingStatus.successful > 0 || processingStatus.failed > 0) && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="font-medium text-green-900 dark:text-green-100">
                  Processing Complete
                </span>
                <Badge variant="outline" className="text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                  {processingStatus.successful} audited
                </Badge>
                {processingStatus.failed > 0 && (
                  <Badge variant="outline" className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
                    {processingStatus.failed} failed
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchData()}
                className="text-green-700 dark:text-green-300"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh List
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Calls ({stats.totalCalls})</TabsTrigger>
          <TabsTrigger value="audited" className="text-green-600">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Audited ({stats.audited})
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-yellow-600">
            <Clock className="h-4 w-4 mr-1" />
            Pending ({stats.pending})
          </TabsTrigger>
          {processingStatus?.isProcessing && (
            <TabsTrigger value="processing" className="text-blue-600">
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing ({processingStatus.total - processingStatus.processed})
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

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
                  const isCurrentlyProcessing = processingStatus?.isProcessing && processingStatus?.currentCallId === call.id;

                  return (
                    <div
                      key={call.id}
                      className={`p-4 rounded-lg bg-[var(--color-bg)] border cursor-pointer hover:bg-[var(--color-surface)] transition-colors ${
                        selectedCall?.id === call.id ? 'ring-2 ring-[var(--color-accent)]' : ''
                      } ${isCurrentlyProcessing ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20 animate-pulse' : 'border-[var(--color-border)]'}`}
                      onClick={() => setSelectedCall(call)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${isCurrentlyProcessing ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-[var(--color-surface)]'}`}>
                            {isCurrentlyProcessing ? (
                              <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                            ) : (
                              <Phone className="h-4 w-4 text-[var(--color-accent)]" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-[var(--color-text)]">{call.campaign_name || call.call_id}</p>
                              {call.is_bookmarked && (
                                <Bookmark className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              )}
                              {isCurrentlyProcessing && (
                                <Badge variant="default" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  {processingStatus?.currentStep || 'Processing'}
                                </Badge>
                              )}
                              {call.status === 'audited' && !isCurrentlyProcessing && (
                                <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Audited
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-subtext)]">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {call.call_start_time ? new Date(call.call_start_time).toLocaleString() : 'N/A'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {Math.floor((call.call_duration_seconds || 0) / 60)}m {(call.call_duration_seconds || 0) % 60}s
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {call.disposition || call.call_type || 'Unknown'}
                              </Badge>
                            </div>
                            {call.customer_name && (
                              <p className="text-xs text-[var(--color-subtext)] mt-1">
                                Customer: {call.customer_name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {score !== undefined && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex items-center gap-2 h-auto py-1 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingReportCard({ callId: call.id });
                              }}
                            >
                              <div className="text-right">
                                <p className="text-xs text-[var(--color-subtext)]">Score</p>
                                <p className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</p>
                              </div>
                              <FileText className="h-4 w-4 text-[var(--color-accent)]" />
                            </Button>
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
                  <p className="text-xs text-[var(--color-subtext)]">Campaign</p>
                  <p className="font-medium text-[var(--color-text)]">{selectedCall.campaign_name || selectedCall.call_id}</p>
                </div>
                {selectedCall.customer_name && (
                  <div>
                    <p className="text-xs text-[var(--color-subtext)]">Customer</p>
                    <p className="font-medium text-[var(--color-text)]">{selectedCall.customer_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Date & Time</p>
                  <p className="text-[var(--color-text)]">
                    {selectedCall.call_start_time ? new Date(selectedCall.call_start_time).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Duration</p>
                  <p className="text-[var(--color-text)]">
                    {Math.floor((selectedCall.call_duration_seconds || 0) / 60)}m {(selectedCall.call_duration_seconds || 0) % 60}s
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-subtext)]">Disposition</p>
                  <Badge variant="secondary">{selectedCall.disposition || selectedCall.call_type || 'Unknown'}</Badge>
                </div>

                {/* Process Button - Show if call has transcript but no report card */}
                {selectedCall.transcript_text && !selectedCall.report_cards?.[0] && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <Button
                      className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                      onClick={() => processCall(selectedCall.id)}
                      disabled={processingCall === selectedCall.id}
                    >
                      {processingCall === selectedCall.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Process with AI
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-[var(--color-subtext)] mt-2 text-center">
                      AI will analyze the transcript and generate a report card
                    </p>
                  </div>
                )}

                {/* Re-process button for already audited calls */}
                {selectedCall.report_cards?.[0] && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => processCall(selectedCall.id)}
                      disabled={processingCall === selectedCall.id}
                    >
                      {processingCall === selectedCall.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Re-processing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Re-process Call
                        </>
                      )}
                    </Button>
                  </div>
                )}

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
                    <Button
                      size="sm"
                      className="w-full mt-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white"
                      onClick={() => setViewingReportCard({ callId: selectedCall.id })}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Full Report Card
                    </Button>
                  </div>
                )}

                {/* Audio Player */}
                {selectedCall.recording_url && (
                  <div className="pt-4 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-subtext)] mb-2">Recording</p>
                    <audio
                      controls
                      className="w-full h-10"
                      src={selectedCall.recording_url}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}

                {/* Add Tag */}
                <div className="pt-4 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-subtext)] mb-2">Add Tag</p>
                  <div className="flex flex-wrap gap-1">
                    {tags.length > 0 ? tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="cursor-pointer hover:bg-[var(--color-bg)]"
                          onClick={() => addTagToCall(selectedCall.id, tag.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tag.name}
                        </Badge>
                      )) : (
                        <p className="text-xs text-[var(--color-subtext)]">No tags available</p>
                      )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-[var(--color-border)] flex flex-wrap gap-2">
                  {selectedCall.recording_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(selectedCall.recording_url, '_blank')}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                  )}
                  {selectedCall.transcript_text && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: 'Transcript',
                          description: selectedCall.transcript_text?.substring(0, 200) + '...',
                        });
                      }}
                    >
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

      {/* Report Card Viewer */}
      <ReportCardViewer
        callId={viewingReportCard?.callId}
        reportCardId={viewingReportCard?.reportCardId}
        isOpen={!!viewingReportCard}
        onClose={() => setViewingReportCard(null)}
      />
    </div>
  );
};
