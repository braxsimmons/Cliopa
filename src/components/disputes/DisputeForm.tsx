import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, Send, FileText } from 'lucide-react';

interface ReportCard {
  id: string;
  overall_score: number;
  communication_score?: number;
  compliance_score?: number;
  accuracy_score?: number;
  tone_score?: number;
  empathy_score?: number;
  resolution_score?: number;
  source_file?: string;
  created_at: string;
  criteria_results?: Record<string, { result: string; explanation?: string }>;
}

interface CriterionDispute {
  criterion_id: string;
  original_result: string;
  agent_claim: string;
}

interface DisputeFormProps {
  reportCard: ReportCard;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const CRITERION_LABELS: Record<string, string> = {
  QQ: 'Qualifying Questions',
  VCI: 'Customer Information Verification',
  PERMISSION: 'Marketing Permissions',
  CAMPAIGN: 'Campaign Noted',
  BANKV: 'Bank Verification',
  REVIEW_TERMS: 'Review Terms',
  LOAN_DOCUMENT: 'Loan Documentation',
  NOTES: 'Proper Notes',
  INITIATIONS: 'Loan Initiations',
  CHANGE_REQUESTS: 'Change Requests',
  NOTIFICATION: 'Follow-up Notification',
  PMT_REMINDERS: 'Payment Reminders',
  ACCOMODATION: 'Accommodation Procedures',
  FOLLOWUP: 'Required Follow-up',
  WHY_SMILE: 'Sincerity & Tone',
  WHAT_TIMELY: 'Timely Response',
  WHAT_EMPATHY: 'Empathy & Care',
  WHAT_LISTEN_EXPLORE: 'Active Listening',
  WHERE_RESOLUTION: 'Fair Resolution',
  WHO_CORE_VALUES: 'Core Values',
  HOW_PROCESS: 'Process Compliance',
  HOW_SCRIPTS: 'Script Compliance',
};

const RESULT_COLORS: Record<string, string> = {
  PASS: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  FAIL: 'bg-red-100 text-red-800',
};

export const DisputeForm: React.FC<DisputeFormProps> = ({
  reportCard,
  open,
  onClose,
  onSubmitted
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [disputeReason, setDisputeReason] = useState('');
  const [supportingEvidence, setSupportingEvidence] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [selectedCriteria, setSelectedCriteria] = useState<Record<string, CriterionDispute>>({});

  const criteriaResults = reportCard.criteria_results || {};

  const handleCriterionToggle = (criterionId: string, result: string) => {
    setSelectedCriteria(prev => {
      if (prev[criterionId]) {
        const { [criterionId]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [criterionId]: {
          criterion_id: criterionId,
          original_result: result,
          agent_claim: ''
        }
      };
    });
  };

  const handleClaimChange = (criterionId: string, claim: string) => {
    setSelectedCriteria(prev => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        agent_claim: claim
      }
    }));
  };

  const handleSubmit = async () => {
    if (!disputeReason.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a reason for your dispute.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const criteriaDisputed = Object.values(selectedCriteria).filter(c => c.agent_claim.trim());

      const { error } = await supabase
        .from('score_disputes')
        .insert({
          report_card_id: reportCard.id,
          user_id: user?.id,
          dispute_reason: disputeReason,
          criteria_disputed: criteriaDisputed,
          supporting_evidence: supportingEvidence || null,
          priority,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Dispute Submitted',
        description: 'Your dispute has been submitted for review. You will be notified of the outcome.',
      });

      onSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting dispute:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit dispute. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const failedOrPartialCriteria = Object.entries(criteriaResults).filter(
    ([_, value]) => value.result === 'FAIL' || value.result === 'PARTIAL'
  );

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Dispute Score
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Card Summary */}
          <div className="bg-[var(--color-bg)] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--color-subtext)]">
                {reportCard.source_file || 'Call Audit'}
              </span>
              <Badge variant="outline">
                Score: {reportCard.overall_score?.toFixed(1)}
              </Badge>
            </div>
            <p className="text-xs text-[var(--color-subtext)]">
              Audited on {new Date(reportCard.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'normal' | 'high')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Minor scoring discrepancy</SelectItem>
                <SelectItem value="normal">Normal - Standard dispute</SelectItem>
                <SelectItem value="high">High - Significant impact on performance record</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason for Dispute */}
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason for Dispute *</Label>
            <Textarea
              id="dispute-reason"
              placeholder="Explain why you believe this score should be reconsidered..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={4}
            />
          </div>

          {/* Criteria to Dispute */}
          {failedOrPartialCriteria.length > 0 && (
            <div className="space-y-3">
              <Label>Specific Criteria to Dispute (Optional)</Label>
              <p className="text-xs text-[var(--color-subtext)]">
                Select any criteria you believe were incorrectly scored and explain why.
              </p>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {failedOrPartialCriteria.map(([criterionId, value]) => (
                  <div
                    key={criterionId}
                    className={`border rounded-lg p-3 transition-colors ${
                      selectedCriteria[criterionId]
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                        : 'border-[var(--color-border)]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={!!selectedCriteria[criterionId]}
                        onCheckedChange={() => handleCriterionToggle(criterionId, value.result)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {CRITERION_LABELS[criterionId] || criterionId}
                          </span>
                          <Badge className={RESULT_COLORS[value.result]}>
                            {value.result}
                          </Badge>
                        </div>
                        {value.explanation && (
                          <p className="text-xs text-[var(--color-subtext)] mb-2">
                            AI Note: {value.explanation}
                          </p>
                        )}
                        {selectedCriteria[criterionId] && (
                          <Textarea
                            placeholder="Explain why this should be scored differently (e.g., 'At timestamp 2:35, I clearly asked the qualifying questions...')"
                            value={selectedCriteria[criterionId].agent_claim}
                            onChange={(e) => handleClaimChange(criterionId, e.target.value)}
                            rows={2}
                            className="mt-2"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supporting Evidence */}
          <div className="space-y-2">
            <Label htmlFor="evidence">Supporting Evidence (Optional)</Label>
            <Textarea
              id="evidence"
              placeholder="Include timestamps, quotes, or other evidence supporting your dispute..."
              value={supportingEvidence}
              onChange={(e) => setSupportingEvidence(e.target.value)}
              rows={3}
            />
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your dispute will be reviewed by a manager within 2-3 business days.
              You will receive a notification when a decision is made.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !disputeReason.trim()}
            className="bg-[var(--color-accent)] hover:bg-[var(--color-accent)]/90"
          >
            {isSubmitting ? (
              'Submitting...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Dispute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
