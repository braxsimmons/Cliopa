import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  MessageSquare,
  History,
  ChevronRight,
  Play,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

interface Dispute {
  id: string;
  report_card_id: string;
  user_id: string;
  dispute_reason: string;
  criteria_disputed: Array<{
    criterion_id: string;
    original_result: string;
    agent_claim: string;
  }>;
  supporting_evidence?: string;
  status: string;
  priority: string;
  reviewed_by?: string;
  reviewed_at?: string;
  resolution_notes?: string;
  adjusted_scores?: Record<string, number>;
  created_at: string;
  // Joined data
  agent_name?: string;
  agent_email?: string;
  original_score?: number;
  source_file?: string;
  reviewer_name?: string;
}

interface DisputeComment {
  id: string;
  dispute_id: string;
  user_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  user_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800', icon: Play },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  partially_approved: { label: 'Partially Approved', color: 'bg-teal-100 text-teal-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-800', icon: XCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-800',
  normal: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const CRITERION_LABELS: Record<string, string> = {
  QQ: 'Qualifying Questions',
  VCI: 'Customer Information Verification',
  PERMISSION: 'Marketing Permissions',
  WHY_SMILE: 'Sincerity & Tone',
  WHAT_EMPATHY: 'Empathy & Care',
  WHERE_RESOLUTION: 'Fair Resolution',
  HOW_PROCESS: 'Process Compliance',
  HOW_SCRIPTS: 'Script Compliance',
};

export const DisputeManagement: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [comments, setComments] = useState<DisputeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);

  // Resolution form state
  const [resolutionStatus, setResolutionStatus] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [adjustedScores, setAdjustedScores] = useState<Record<string, number>>({});
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, [activeTab]);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const statusFilter = activeTab === 'pending'
        ? ['pending', 'under_review']
        : activeTab === 'resolved'
        ? ['approved', 'partially_approved', 'rejected']
        : [];

      let query = supabase
        .from('score_disputes')
        .select(`
          *,
          profiles!score_disputes_user_id_fkey (first_name, last_name, email),
          report_cards!score_disputes_report_card_id_fkey (overall_score, source_file),
          reviewer:profiles!score_disputes_reviewed_by_fkey (first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter.length > 0) {
        query = query.in('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formatted = (data || []).map((d: any) => ({
        ...d,
        agent_name: d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : 'Unknown',
        agent_email: d.profiles?.email,
        original_score: d.report_cards?.overall_score,
        source_file: d.report_cards?.source_file,
        reviewer_name: d.reviewer ? `${d.reviewer.first_name} ${d.reviewer.last_name}` : null,
      }));

      setDisputes(formatted);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load disputes.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (disputeId: string) => {
    try {
      const { data, error } = await supabase
        .from('dispute_comments')
        .select(`
          *,
          profiles (first_name, last_name)
        `)
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments((data || []).map((c: any) => ({
        ...c,
        user_name: c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : 'Unknown'
      })));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSelectDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    fetchComments(dispute.id);
    setAdjustedScores({
      overall_score: dispute.original_score || 0
    });
  };

  const handleStartReview = async (dispute: Dispute) => {
    try {
      const { error } = await supabase
        .from('score_disputes')
        .update({
          status: 'under_review',
          reviewed_by: user?.id
        })
        .eq('id', dispute.id);

      if (error) throw error;

      toast({
        title: 'Review Started',
        description: 'You are now reviewing this dispute.',
      });

      fetchDisputes();
      if (selectedDispute?.id === dispute.id) {
        setSelectedDispute({ ...dispute, status: 'under_review', reviewed_by: user?.id });
      }
    } catch (error) {
      console.error('Error starting review:', error);
      toast({
        title: 'Error',
        description: 'Failed to start review.',
        variant: 'destructive'
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDispute) return;

    try {
      const { error } = await supabase
        .from('dispute_comments')
        .insert({
          dispute_id: selectedDispute.id,
          user_id: user?.id,
          comment: newComment,
          is_internal: isInternalComment
        });

      if (error) throw error;

      setNewComment('');
      fetchComments(selectedDispute.id);

      toast({
        title: 'Comment Added',
        description: isInternalComment ? 'Internal note added.' : 'Comment added.',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleResolve = async () => {
    if (!selectedDispute || !resolutionStatus) return;

    try {
      const { error } = await supabase
        .from('score_disputes')
        .update({
          status: resolutionStatus,
          resolution_notes: resolutionNotes,
          adjusted_scores: resolutionStatus === 'rejected' ? null : adjustedScores,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', selectedDispute.id);

      if (error) throw error;

      toast({
        title: 'Dispute Resolved',
        description: `Dispute has been ${resolutionStatus.replace('_', ' ')}.`,
      });

      setResolveDialogOpen(false);
      setSelectedDispute(null);
      setResolutionStatus('');
      setResolutionNotes('');
      fetchDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve dispute.',
        variant: 'destructive'
      });
    }
  };

  const pendingCount = disputes.filter(d => d.status === 'pending' || d.status === 'under_review').length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Disputes List */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Score Disputes
              {pendingCount > 0 && (
                <Badge className="bg-red-500 text-white ml-2">{pendingCount}</Badge>
              )}
            </CardTitle>
            <CardDescription>Review and resolve agent score disputes</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-2 mb-4">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[500px]">
                {loading ? (
                  <div className="text-center py-8 text-[var(--color-subtext)]">Loading...</div>
                ) : disputes.length === 0 ? (
                  <div className="text-center py-8 text-[var(--color-subtext)]">
                    No {activeTab} disputes
                  </div>
                ) : (
                  <div className="space-y-2">
                    {disputes.map(dispute => {
                      const StatusIcon = STATUS_CONFIG[dispute.status]?.icon || Clock;
                      return (
                        <div
                          key={dispute.id}
                          onClick={() => handleSelectDispute(dispute)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedDispute?.id === dispute.id
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                              : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-[var(--color-subtext)]" />
                              <span className="font-medium text-sm">{dispute.agent_name}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-[var(--color-subtext)]" />
                          </div>

                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge className={STATUS_CONFIG[dispute.status]?.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {STATUS_CONFIG[dispute.status]?.label}
                            </Badge>
                            <Badge className={PRIORITY_COLORS[dispute.priority]}>
                              {dispute.priority}
                            </Badge>
                          </div>

                          <p className="text-xs text-[var(--color-subtext)] line-clamp-2">
                            {dispute.dispute_reason}
                          </p>

                          <p className="text-xs text-[var(--color-subtext)] mt-2">
                            {new Date(dispute.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dispute Detail */}
      <div className="lg:col-span-2">
        {selectedDispute ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dispute Details
                </CardTitle>
                <div className="flex gap-2">
                  {selectedDispute.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStartReview(selectedDispute)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start Review
                    </Button>
                  )}
                  {(selectedDispute.status === 'pending' || selectedDispute.status === 'under_review') && (
                    <Button
                      size="sm"
                      onClick={() => setResolveDialogOpen(true)}
                      className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
                    >
                      Resolve Dispute
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Agent & Score Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--color-bg)] p-4 rounded-lg">
                  <Label className="text-xs text-[var(--color-subtext)]">Agent</Label>
                  <p className="font-medium">{selectedDispute.agent_name}</p>
                  <p className="text-xs text-[var(--color-subtext)]">{selectedDispute.agent_email}</p>
                </div>
                <div className="bg-[var(--color-bg)] p-4 rounded-lg">
                  <Label className="text-xs text-[var(--color-subtext)]">Original Score</Label>
                  <p className="text-2xl font-bold text-[var(--color-accent)]">
                    {selectedDispute.original_score?.toFixed(1)}
                  </p>
                  <p className="text-xs text-[var(--color-subtext)]">{selectedDispute.source_file}</p>
                </div>
              </div>

              {/* Dispute Reason */}
              <div>
                <Label className="text-xs text-[var(--color-subtext)]">Reason for Dispute</Label>
                <p className="mt-1 text-sm">{selectedDispute.dispute_reason}</p>
              </div>

              {/* Disputed Criteria */}
              {selectedDispute.criteria_disputed && selectedDispute.criteria_disputed.length > 0 && (
                <div>
                  <Label className="text-xs text-[var(--color-subtext)] mb-2 block">
                    Disputed Criteria
                  </Label>
                  <div className="space-y-2">
                    {selectedDispute.criteria_disputed.map((criterion, idx) => (
                      <div key={idx} className="bg-[var(--color-bg)] p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {CRITERION_LABELS[criterion.criterion_id] || criterion.criterion_id}
                          </span>
                          <Badge className="bg-red-100 text-red-800">
                            {criterion.original_result}
                          </Badge>
                        </div>
                        <p className="text-sm text-[var(--color-subtext)]">{criterion.agent_claim}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Supporting Evidence */}
              {selectedDispute.supporting_evidence && (
                <div>
                  <Label className="text-xs text-[var(--color-subtext)]">Supporting Evidence</Label>
                  <p className="mt-1 text-sm bg-[var(--color-bg)] p-3 rounded-lg">
                    {selectedDispute.supporting_evidence}
                  </p>
                </div>
              )}

              {/* Resolution (if resolved) */}
              {selectedDispute.resolution_notes && (
                <div className="border-t border-[var(--color-border)] pt-4">
                  <Label className="text-xs text-[var(--color-subtext)]">Resolution Notes</Label>
                  <p className="mt-1 text-sm">{selectedDispute.resolution_notes}</p>
                  {selectedDispute.reviewer_name && (
                    <p className="text-xs text-[var(--color-subtext)] mt-2">
                      Resolved by {selectedDispute.reviewer_name} on{' '}
                      {new Date(selectedDispute.reviewed_at!).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              <Separator />

              {/* Comments Section */}
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4" />
                  Comments
                </Label>

                <div className="space-y-3 max-h-48 overflow-y-auto mb-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-[var(--color-subtext)]">No comments yet</p>
                  ) : (
                    comments.map(comment => (
                      <div
                        key={comment.id}
                        className={`p-3 rounded-lg ${
                          comment.is_internal
                            ? 'bg-yellow-50 border border-yellow-200'
                            : 'bg-[var(--color-bg)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{comment.user_name}</span>
                          {comment.is_internal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                          <span className="text-xs text-[var(--color-subtext)]">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{comment.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded"
                      />
                      Internal note (not visible to agent)
                    </label>
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!newComment.trim()}
                    >
                      Add Comment
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-[var(--color-subtext)] mb-4" />
              <h3 className="font-medium text-lg mb-2">Select a Dispute</h3>
              <p className="text-[var(--color-subtext)]">
                Choose a dispute from the list to view details and take action.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolution Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Decision *</Label>
              <Select value={resolutionStatus} onValueChange={setResolutionStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select decision..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-green-600" />
                      Approve - Full adjustment
                    </div>
                  </SelectItem>
                  <SelectItem value="partially_approved">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-teal-600" />
                      Partially Approve
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-red-600" />
                      Reject
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {resolutionStatus !== 'rejected' && (
              <div>
                <Label>Adjusted Overall Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={adjustedScores.overall_score || ''}
                  onChange={(e) => setAdjustedScores({
                    ...adjustedScores,
                    overall_score: parseFloat(e.target.value) || 0
                  })}
                />
                <p className="text-xs text-[var(--color-subtext)] mt-1">
                  Original: {selectedDispute?.original_score?.toFixed(1)}
                </p>
              </div>
            )}

            <div>
              <Label>Resolution Notes *</Label>
              <Textarea
                placeholder="Explain your decision..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={!resolutionStatus || !resolutionNotes.trim()}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
            >
              Submit Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
