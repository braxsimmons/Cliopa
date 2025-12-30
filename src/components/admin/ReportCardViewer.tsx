import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Shield,
  MessageSquare,
  Heart,
  Target,
  Clock,
  Phone,
  Play,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';

interface ReportCardData {
  id: string;
  overall_score: number;
  communication_score?: number;
  compliance_score?: number;
  accuracy_score?: number;
  tone_score?: number;
  empathy_score?: number;
  resolution_score?: number;
  feedback?: string;
  strengths?: string[];
  areas_for_improvement?: string[];
  recommendations?: string[];
  criteria_results?: Record<string, any>;
  created_at: string;
  call?: {
    id: string;
    call_start_time?: string;
    call_duration_seconds?: number;
    campaign_name?: string;
    customer_name?: string;
    disposition?: string;
    recording_url?: string;
    transcript_text?: string;
  };
}

interface ReportCardViewerProps {
  reportCardId?: string;
  callId?: string;
  isOpen: boolean;
  onClose: () => void;
}

const getScoreColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'text-gray-500';
  if (score >= 90) return 'text-green-500';
  if (score >= 80) return 'text-lime-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 60) return 'text-orange-500';
  return 'text-red-500';
};

const getScoreBgColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'bg-gray-100 dark:bg-gray-800';
  if (score >= 90) return 'bg-green-100 dark:bg-green-900/30';
  if (score >= 80) return 'bg-lime-100 dark:bg-lime-900/30';
  if (score >= 70) return 'bg-yellow-100 dark:bg-yellow-900/30';
  if (score >= 60) return 'bg-orange-100 dark:bg-orange-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
};

const getScoreLabel = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Average';
  if (score >= 60) return 'Needs Improvement';
  return 'Critical';
};

export const ReportCardViewer = ({
  reportCardId,
  callId,
  isOpen,
  onClose,
}: ReportCardViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && (reportCardId || callId)) {
      fetchReportCard();
    }
  }, [isOpen, reportCardId, callId]);

  const fetchReportCard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('report_cards')
        .select(`
          *,
          call:call_id (
            id,
            call_start_time,
            call_duration_seconds,
            campaign_name,
            customer_name,
            disposition,
            recording_url,
            transcript_text
          )
        `);

      if (reportCardId) {
        query = query.eq('id', reportCardId);
      } else if (callId) {
        query = query.eq('call_id', callId);
      }

      const { data, error } = await query.single();

      if (error) throw error;
      setReportCard(data);
    } catch (error) {
      console.error('Error fetching report card:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCriteria = (criteriaId: string) => {
    setExpandedCriteria(prev =>
      prev.includes(criteriaId)
        ? prev.filter(id => id !== criteriaId)
        : [...prev, criteriaId]
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-[var(--color-surface)] border-[var(--color-border)] p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[var(--color-text)] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--color-accent)]" />
              AI Performance Report Card
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full">
            <div className="p-6 pt-4 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner size="lg" />
                </div>
              ) : !reportCard ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-[var(--color-text)]">Report card not found</p>
                </div>
              ) : (
                <>
                  {/* Call Info Header */}
                  {reportCard.call && (
                    <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-full bg-[var(--color-surface)]">
                              <Phone className="h-5 w-5 text-[var(--color-accent)]" />
                            </div>
                            <div>
                              <p className="font-medium text-[var(--color-text)]">
                                {reportCard.call.campaign_name || 'Call Recording'}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-[var(--color-subtext)]">
                                {reportCard.call.call_start_time && (
                                  <span>{new Date(reportCard.call.call_start_time).toLocaleString()}</span>
                                )}
                                {reportCard.call.call_duration_seconds && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {Math.floor(reportCard.call.call_duration_seconds / 60)}m{' '}
                                      {reportCard.call.call_duration_seconds % 60}s
                                    </span>
                                  </>
                                )}
                                {reportCard.call.disposition && (
                                  <>
                                    <span>•</span>
                                    <Badge variant="secondary">{reportCard.call.disposition}</Badge>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          {reportCard.call.recording_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(reportCard.call?.recording_url, '_blank')}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Play Recording
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Overall Score */}
                  <Card className={`border-2 ${getScoreBgColor(reportCard.overall_score)}`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-[var(--color-subtext)]">Overall Score</p>
                          <div className="flex items-baseline gap-2">
                            <p className={`text-5xl font-bold ${getScoreColor(reportCard.overall_score)}`}>
                              {reportCard.overall_score}
                            </p>
                            <span className="text-2xl text-[var(--color-subtext)]">/ 100</span>
                          </div>
                          <Badge className="mt-2" variant="secondary">
                            {getScoreLabel(reportCard.overall_score)}
                          </Badge>
                        </div>
                        <div className="text-right text-sm text-[var(--color-subtext)]">
                          <p>Audited on</p>
                          <p className="font-medium text-[var(--color-text)]">
                            {new Date(reportCard.created_at).toLocaleDateString()}
                          </p>
                          <p>{new Date(reportCard.created_at).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Category Scores */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {reportCard.compliance_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Compliance</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.compliance_score)}`}>
                            {reportCard.compliance_score}%
                          </p>
                          <Progress value={reportCard.compliance_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                    {reportCard.communication_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Communication</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.communication_score)}`}>
                            {reportCard.communication_score}%
                          </p>
                          <Progress value={reportCard.communication_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                    {reportCard.empathy_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="h-4 w-4 text-pink-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Empathy</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.empathy_score)}`}>
                            {reportCard.empathy_score}%
                          </p>
                          <Progress value={reportCard.empathy_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                    {reportCard.accuracy_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-4 w-4 text-purple-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Accuracy</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.accuracy_score)}`}>
                            {reportCard.accuracy_score}%
                          </p>
                          <Progress value={reportCard.accuracy_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                    {reportCard.tone_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-orange-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Tone</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.tone_score)}`}>
                            {reportCard.tone_score}%
                          </p>
                          <Progress value={reportCard.tone_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                    {reportCard.resolution_score !== undefined && (
                      <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-teal-500" />
                            <span className="text-sm text-[var(--color-subtext)]">Resolution</span>
                          </div>
                          <p className={`text-2xl font-bold ${getScoreColor(reportCard.resolution_score)}`}>
                            {reportCard.resolution_score}%
                          </p>
                          <Progress value={reportCard.resolution_score} className="h-1.5 mt-2" />
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* AI Feedback */}
                  {reportCard.feedback && (
                    <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-[var(--color-text)] flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          AI Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[var(--color-text)] whitespace-pre-wrap leading-relaxed">
                          {reportCard.feedback}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reportCard.strengths && reportCard.strengths.length > 0 && (
                      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Strengths
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {reportCard.strengths.map((strength, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
                                <span className="text-green-500 mt-1">✓</span>
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {reportCard.areas_for_improvement && reportCard.areas_for_improvement.length > 0 && (
                      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-orange-800 dark:text-orange-200 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Areas for Improvement
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {reportCard.areas_for_improvement.map((area, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
                                <span className="text-orange-500 mt-1">!</span>
                                {area}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Recommendations */}
                  {reportCard.recommendations && reportCard.recommendations.length > 0 && (
                    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" />
                          Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {reportCard.recommendations.map((rec, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                              <span className="text-blue-500 mt-1">💡</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Criteria Results */}
                  {reportCard.criteria_results && Object.keys(reportCard.criteria_results).length > 0 && (
                    <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-[var(--color-text)] flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Detailed Criteria Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(reportCard.criteria_results).map(([key, value]: [string, any]) => (
                            <div
                              key={key}
                              className="border border-[var(--color-border)] rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => toggleCriteria(key)}
                                className="w-full flex items-center justify-between p-3 bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-xs text-[var(--color-subtext)] bg-[var(--color-bg)] px-2 py-1 rounded">
                                    {key}
                                  </span>
                                  <span className="text-sm text-[var(--color-text)]">
                                    {value.name || key}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`font-bold ${getScoreColor(value.score)}`}>
                                    {value.score !== undefined ? `${value.score}%` : 'N/A'}
                                  </span>
                                  {expandedCriteria.includes(key) ? (
                                    <ChevronUp className="h-4 w-4 text-[var(--color-subtext)]" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-[var(--color-subtext)]" />
                                  )}
                                </div>
                              </button>
                              {expandedCriteria.includes(key) && (
                                <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
                                  {value.feedback && (
                                    <p className="text-sm text-[var(--color-text)] mb-2">{value.feedback}</p>
                                  )}
                                  {value.evidence && (
                                    <div className="mt-2">
                                      <p className="text-xs text-[var(--color-subtext)] mb-1">Evidence:</p>
                                      <p className="text-sm text-[var(--color-text)] italic bg-[var(--color-surface)] p-2 rounded">
                                        "{value.evidence}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Transcript */}
                  {reportCard.call?.transcript_text && (
                    <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <CardHeader className="pb-2">
                        <button
                          onClick={() => setShowTranscript(!showTranscript)}
                          className="w-full flex items-center justify-between"
                        >
                          <CardTitle className="text-sm text-[var(--color-text)] flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Call Transcript
                          </CardTitle>
                          {showTranscript ? (
                            <ChevronUp className="h-4 w-4 text-[var(--color-subtext)]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[var(--color-subtext)]" />
                          )}
                        </button>
                      </CardHeader>
                      {showTranscript && (
                        <CardContent>
                          <div className="bg-[var(--color-surface)] p-4 rounded-lg max-h-[400px] overflow-y-auto">
                            <pre className="text-sm text-[var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed">
                              {reportCard.call.transcript_text}
                            </pre>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
