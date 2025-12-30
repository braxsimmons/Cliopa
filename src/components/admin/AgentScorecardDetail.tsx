import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Calendar,
  Clock,
  BarChart3,
  X,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Sparkles,
  Users,
  MessageSquare,
  Shield,
  Heart,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { CoachingService, AgentScorecard, AgentGoal, CoachingSession } from '@/services/CoachingService';
import { supabase } from '@/integrations/supabase/client';
import { ReportCardViewer } from './ReportCardViewer';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

interface AgentScorecardDetailProps {
  agentId: string;
  onClose: () => void;
}

interface ScoreHistory {
  date: string;
  score: number;
  compliance: number;
  communication: number;
  empathy: number;
}

interface ReportCard {
  id: string;
  overall_score: number;
  compliance_score: number;
  communication_score: number;
  empathy_score: number;
  created_at: string;
  call?: {
    id: string;
    call_start_time: string;
    call_duration_seconds: number;
    disposition: string;
    recording_url?: string;
    campaign_name?: string;
  };
}

const SCORE_COLORS = {
  excellent: '#22c55e',
  good: '#84cc16',
  average: '#eab308',
  poor: '#f97316',
  critical: '#ef4444',
};

const getScoreColor = (score: number | null): string => {
  if (score === null || score === undefined) return '#6b7280';
  if (score >= 90) return SCORE_COLORS.excellent;
  if (score >= 80) return SCORE_COLORS.good;
  if (score >= 70) return SCORE_COLORS.average;
  if (score >= 60) return SCORE_COLORS.poor;
  return SCORE_COLORS.critical;
};

const getScoreLabel = (score: number | null): string => {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Average';
  if (score >= 60) return 'Needs Improvement';
  return 'Critical';
};

export const AgentScorecardDetail = ({ agentId, onClose }: AgentScorecardDetailProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scorecard, setScorecard] = useState<AgentScorecard | null>(null);
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [coachingSessions, setCoachingSessions] = useState<CoachingSession[]>([]);
  const [recentReportCards, setRecentReportCards] = useState<ReportCard[]>([]);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory[]>([]);
  const [teamAverage, setTeamAverage] = useState<number>(0);
  const [viewingReportCard, setViewingReportCard] = useState<string | null>(null);

  useEffect(() => {
    fetchAgentData();
  }, [agentId]);

  const fetchAgentData = async () => {
    setLoading(true);
    try {
      // Fetch scorecard
      const scorecardData = await CoachingService.getAgentScorecard(agentId);
      setScorecard(scorecardData);

      // Fetch goals
      const goalsData = await CoachingService.getAgentGoals({ agentId, status: 'active' });
      setGoals(goalsData);

      // Fetch coaching sessions
      const sessionsData = await CoachingService.getCoachingSessions({ agentId });
      setCoachingSessions(sessionsData);

      // Fetch recent report cards for history
      const { data: reportCards, error: rcError } = await supabase
        .from('report_cards')
        .select(`
          id,
          overall_score,
          compliance_score,
          communication_score,
          empathy_score,
          created_at,
          call:call_id (id, call_start_time, call_duration_seconds, disposition, recording_url, campaign_name)
        `)
        .eq('user_id', agentId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (rcError) throw rcError;
      setRecentReportCards(reportCards || []);

      // Generate score history from report cards (last 30 days, grouped by day)
      const history: Record<string, { scores: number[]; compliance: number[]; communication: number[]; empathy: number[] }> = {};
      (reportCards || []).forEach((rc: ReportCard) => {
        const date = new Date(rc.created_at).toISOString().split('T')[0];
        if (!history[date]) {
          history[date] = { scores: [], compliance: [], communication: [], empathy: [] };
        }
        if (rc.overall_score) history[date].scores.push(rc.overall_score);
        if (rc.compliance_score) history[date].compliance.push(rc.compliance_score);
        if (rc.communication_score) history[date].communication.push(rc.communication_score);
        if (rc.empathy_score) history[date].empathy.push(rc.empathy_score);
      });

      const historyData = Object.entries(history)
        .map(([date, data]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
          compliance: Math.round(data.compliance.reduce((a, b) => a + b, 0) / data.compliance.length) || 0,
          communication: Math.round(data.communication.reduce((a, b) => a + b, 0) / data.communication.length) || 0,
          empathy: Math.round(data.empathy.reduce((a, b) => a + b, 0) / data.empathy.length) || 0,
        }))
        .reverse()
        .slice(-14); // Last 14 data points

      setScoreHistory(historyData);

      // Calculate team average
      if (scorecardData?.team) {
        const teamScorecards = await CoachingService.getAgentScorecards({ team: scorecardData.team });
        const avgScore = teamScorecards.filter(s => s.avg_score_30d).reduce((a, b) => a + (b.avg_score_30d || 0), 0) / teamScorecards.length;
        setTeamAverage(Math.round(avgScore));
      }
    } catch (error) {
      console.error('Error fetching agent data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[var(--color-surface)]">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </Card>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <Card className="w-full max-w-md bg-[var(--color-surface)]">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-[var(--color-text)]">Agent not found or no data available</p>
            <Button variant="outline" onClick={onClose} className="mt-4">
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prepare radar chart data
  const radarData = [
    { skill: 'Compliance', value: scorecard.compliance_30d || 0, fullMark: 100 },
    { skill: 'Communication', value: scorecard.communication_30d || 0, fullMark: 100 },
    { skill: 'Empathy', value: scorecard.empathy_30d || 0, fullMark: 100 },
    { skill: 'Quality', value: scorecard.avg_score_30d || 0, fullMark: 100 },
  ];

  const upcomingSessions = coachingSessions.filter(
    (s) => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date()
  );
  const completedSessions = coachingSessions.filter((s) => s.status === 'completed');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="sticky top-0 bg-[var(--color-surface)] z-10 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="w-12 h-12 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-lg">
                {scorecard.first_name?.charAt(0)}{scorecard.last_name?.charAt(0)}
              </div>
              <div>
                <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
                  {scorecard.first_name} {scorecard.last_name}
                  {scorecard.avg_score_30d && scorecard.avg_score_30d >= 90 && (
                    <Award className="h-5 w-5 text-yellow-500" />
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span>{scorecard.team || 'No Team'}</span>
                  <span>•</span>
                  <span>{scorecard.email}</span>
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--color-subtext)] mb-1">Overall Score</p>
                <p className="text-3xl font-bold" style={{ color: getScoreColor(scorecard.avg_score_30d) }}>
                  {scorecard.avg_score_30d?.toFixed(1) || 'N/A'}%
                </p>
                <Badge variant="secondary" className="mt-1">
                  {getScoreLabel(scorecard.avg_score_30d)}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--color-subtext)] mb-1">Week over Week</p>
                <div className="flex items-center justify-center gap-1">
                  {scorecard.score_change_wow !== null && scorecard.score_change_wow >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  )}
                  <p className={`text-2xl font-bold ${scorecard.score_change_wow >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {scorecard.score_change_wow > 0 ? '+' : ''}{scorecard.score_change_wow?.toFixed(1) || 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--color-subtext)] mb-1">Audits (30d)</p>
                <p className="text-2xl font-bold text-[var(--color-text)]">{scorecard.audits_30d || 0}</p>
                <p className="text-xs text-[var(--color-subtext)]">calls reviewed</p>
              </CardContent>
            </Card>

            <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--color-subtext)] mb-1">vs Team Avg</p>
                <p className={`text-2xl font-bold ${(scorecard.avg_score_30d || 0) >= teamAverage ? 'text-green-500' : 'text-orange-500'}`}>
                  {((scorecard.avg_score_30d || 0) - teamAverage) > 0 ? '+' : ''}{((scorecard.avg_score_30d || 0) - teamAverage).toFixed(1)}%
                </p>
                <p className="text-xs text-[var(--color-subtext)]">Team: {teamAverage}%</p>
              </CardContent>
            </Card>

            <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
              <CardContent className="pt-4 text-center">
                <p className="text-xs text-[var(--color-subtext)] mb-1">Hours Worked</p>
                <p className="text-2xl font-bold text-[var(--color-text)]">{scorecard.hours_worked_30d?.toFixed(0) || 0}</p>
                <p className="text-xs text-[var(--color-subtext)]">last 30 days</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="bg-[var(--color-bg)] border border-[var(--color-border)]">
              <TabsTrigger value="performance" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="skills" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                Skills
              </TabsTrigger>
              <TabsTrigger value="goals" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
                <Target className="h-4 w-4 mr-2" />
                Goals ({goals.length})
              </TabsTrigger>
              <TabsTrigger value="coaching" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
                <Users className="h-4 w-4 mr-2" />
                Coaching ({coachingSessions.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
                <Clock className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            {/* Performance Tab */}
            <TabsContent value="performance" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Trend */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Score Trend (Last 14 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scoreHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={scoreHistory}>
                          <defs>
                            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                          <XAxis dataKey="date" stroke="var(--color-subtext)" fontSize={12} />
                          <YAxis stroke="var(--color-subtext)" fontSize={12} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            name="Overall Score"
                            stroke="var(--color-accent)"
                            fill="url(#scoreGradient)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-[var(--color-subtext)]">
                        No score history available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Category Breakdown */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Category Scores (30 Days)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-blue-500" />
                            <span className="text-sm text-[var(--color-text)]">Compliance</span>
                          </div>
                          <span className="font-bold" style={{ color: getScoreColor(scorecard.compliance_30d) }}>
                            {scorecard.compliance_30d?.toFixed(1) || 'N/A'}%
                          </span>
                        </div>
                        <Progress value={scorecard.compliance_30d || 0} className="h-2" />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-[var(--color-text)]">Communication</span>
                          </div>
                          <span className="font-bold" style={{ color: getScoreColor(scorecard.communication_30d) }}>
                            {scorecard.communication_30d?.toFixed(1) || 'N/A'}%
                          </span>
                        </div>
                        <Progress value={scorecard.communication_30d || 0} className="h-2" />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Heart className="h-4 w-4 text-pink-500" />
                            <span className="text-sm text-[var(--color-text)]">Empathy</span>
                          </div>
                          <span className="font-bold" style={{ color: getScoreColor(scorecard.empathy_30d) }}>
                            {scorecard.empathy_30d?.toFixed(1) || 'N/A'}%
                          </span>
                        </div>
                        <Progress value={scorecard.empathy_30d || 0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Radar Chart */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Skills Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--color-border)" />
                        <PolarAngleAxis dataKey="skill" stroke="var(--color-subtext)" fontSize={12} />
                        <PolarRadiusAxis domain={[0, 100]} stroke="var(--color-border)" fontSize={10} />
                        <Radar
                          name="Score"
                          dataKey="value"
                          stroke="var(--color-accent)"
                          fill="var(--color-accent)"
                          fillOpacity={0.3}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Strengths & Improvement Areas */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Strengths
                      </h4>
                      <div className="space-y-2">
                        {radarData
                          .filter((d) => d.value >= 80)
                          .sort((a, b) => b.value - a.value)
                          .map((skill) => (
                            <div key={skill.skill} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-950/20">
                              <span className="text-sm text-[var(--color-text)]">{skill.skill}</span>
                              <Badge variant="default" className="bg-green-500">{skill.value}%</Badge>
                            </div>
                          ))}
                        {radarData.filter((d) => d.value >= 80).length === 0 && (
                          <p className="text-sm text-[var(--color-subtext)] italic">No standout strengths yet</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Improvement Areas
                      </h4>
                      <div className="space-y-2">
                        {radarData
                          .filter((d) => d.value < 75 && d.value > 0)
                          .sort((a, b) => a.value - b.value)
                          .map((skill) => (
                            <div key={skill.skill} className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-950/20">
                              <span className="text-sm text-[var(--color-text)]">{skill.skill}</span>
                              <Badge variant="secondary">{skill.value}%</Badge>
                            </div>
                          ))}
                        {radarData.filter((d) => d.value < 75 && d.value > 0).length === 0 && (
                          <p className="text-sm text-green-600">All skills above 75%</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals" className="mt-4">
              <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-[var(--color-text)] text-sm">Active Goals</CardTitle>
                  <Button size="sm" variant="outline">
                    <Target className="h-4 w-4 mr-2" />
                    Set New Goal
                  </Button>
                </CardHeader>
                <CardContent>
                  {goals.length > 0 ? (
                    <div className="space-y-4">
                      {goals.map((goal) => {
                        const progress = goal.target_value > 0
                          ? Math.min((goal.current_value / goal.target_value) * 100, 100)
                          : 0;
                        const daysRemaining = Math.ceil(
                          (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                          <div key={goal.id} className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-[var(--color-text)]">{goal.title}</h4>
                                <p className="text-xs text-[var(--color-subtext)]">{goal.description}</p>
                              </div>
                              <Badge variant={goal.priority === 'high' ? 'destructive' : 'secondary'}>
                                {goal.priority}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--color-subtext)]">Progress</span>
                                <span className="font-medium text-[var(--color-text)]">
                                  {goal.current_value} / {goal.target_value} ({progress.toFixed(0)}%)
                                </span>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-[var(--color-subtext)]">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Due: {new Date(goal.target_date).toLocaleDateString()}
                                </span>
                                <span className={daysRemaining < 7 ? 'text-orange-500' : ''}>
                                  {daysRemaining > 0 ? `${daysRemaining} days left` : 'Overdue'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-2" />
                      <p className="text-[var(--color-subtext)]">No active goals</p>
                      <Button variant="outline" size="sm" className="mt-2">
                        Set First Goal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Coaching Tab */}
            <TabsContent value="coaching" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upcoming Sessions */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Upcoming Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingSessions.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingSessions.slice(0, 5).map((session) => (
                          <div key={session.id} className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-[var(--color-text)]">{session.title}</p>
                                <p className="text-xs text-[var(--color-subtext)]">
                                  with {session.coach?.first_name} {session.coach?.last_name}
                                </p>
                              </div>
                              <Badge variant="secondary">{session.session_type.replace('_', ' ')}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-subtext)]">
                              <Calendar className="h-3 w-3" />
                              {new Date(session.scheduled_at).toLocaleString()}
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              {session.duration_minutes} min
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-2" />
                        <p className="text-[var(--color-subtext)]">No upcoming sessions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Sessions */}
                <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                  <CardHeader>
                    <CardTitle className="text-[var(--color-text)] text-sm">Recent Completed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {completedSessions.length > 0 ? (
                      <div className="space-y-3">
                        {completedSessions.slice(0, 5).map((session) => (
                          <div key={session.id} className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-[var(--color-text)]">{session.title}</p>
                              {session.rating && (
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <span key={star} className={star <= session.rating! ? 'text-yellow-500' : 'text-gray-300'}>
                                      ★
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-subtext)] mt-1">
                              {new Date(session.completed_at!).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-2" />
                        <p className="text-[var(--color-subtext)]">No completed sessions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-4">
              <Card className="bg-[var(--color-bg)] border-[var(--color-border)]">
                <CardHeader>
                  <CardTitle className="text-[var(--color-text)] text-sm">Recent Audits</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentReportCards.length > 0 ? (
                    <div className="space-y-2">
                      {recentReportCards.slice(0, 20).map((rc) => (
                        <div
                          key={rc.id}
                          className="flex items-center gap-4 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)] transition-colors"
                          onClick={() => setViewingReportCard(rc.id)}
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getScoreColor(rc.overall_score)}20` }}>
                            <span className="font-bold" style={{ color: getScoreColor(rc.overall_score) }}>
                              {rc.overall_score}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3 text-[var(--color-subtext)]" />
                              <span className="text-sm text-[var(--color-text)]">
                                {new Date(rc.created_at).toLocaleDateString()}
                              </span>
                              {rc.call && (
                                <>
                                  <span className="text-[var(--color-subtext)]">•</span>
                                  <span className="text-xs text-[var(--color-subtext)]">
                                    {Math.floor((rc.call.call_duration_seconds || 0) / 60)}m {(rc.call.call_duration_seconds || 0) % 60}s
                                  </span>
                                  {rc.call.recording_url && (
                                    <>
                                      <span className="text-[var(--color-subtext)]">•</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(rc.call?.recording_url, '_blank');
                                        }}
                                      >
                                        <Play className="h-3 w-3 mr-1" />
                                        Play
                                      </Button>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-subtext)]">
                              <span>Compliance: {rc.compliance_score || 'N/A'}%</span>
                              <span>Communication: {rc.communication_score || 'N/A'}%</span>
                              <span>Empathy: {rc.empathy_score || 'N/A'}%</span>
                            </div>
                          </div>
                          <Badge variant="secondary">{getScoreLabel(rc.overall_score)}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-2" />
                      <p className="text-[var(--color-subtext)]">No audit history available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Report Card Viewer */}
      <ReportCardViewer
        reportCardId={viewingReportCard || undefined}
        isOpen={!!viewingReportCard}
        onClose={() => setViewingReportCard(null)}
      />
    </div>
  );
};
