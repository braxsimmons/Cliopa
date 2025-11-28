import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { ConversationIntelligenceService, CallAnalytics, ConversationInsight } from '@/services/ConversationIntelligenceService';
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Phone,
  Clock,
  Users,
  Target,
  Shield,
  Heart,
  XCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral: '#f59e0b',
  negative: '#ef4444',
  mixed: '#8b5cf6',
};

const OUTCOME_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6b7280',
];

export function ConversationAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | '90d'>('30d');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  const { startDate, endDate } = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : dateRange === '30d' ? 30 : 90;
    const now = new Date();
    return {
      startDate: subDays(now, days).toISOString(),
      endDate: now.toISOString(),
    };
  }, [dateRange]);

  // Fetch call analytics
  const { data: callAnalytics = [], isLoading: analyticsLoading, error: analyticsError, refetch } = useQuery({
    queryKey: ['call-analytics', startDate, endDate],
    queryFn: async () => {
      console.log('Fetching call analytics...');
      const result = await ConversationIntelligenceService.getCallAnalytics({
        startDate,
        endDate,
        limit: 500,
      });
      console.log('Call analytics returned:', result.length, 'records');
      return result;
    },
    retry: false,
    staleTime: 30000,
  });

  // Fetch conversation insights
  const { data: agentInsights = [] } = useQuery({
    queryKey: ['conversation-insights', selectedTeam],
    queryFn: () => ConversationIntelligenceService.getConversationInsights(
      selectedTeam !== 'all' ? { team: selectedTeam } : undefined
    ),
  });

  // Fetch team insights
  const { data: teamInsights = [] } = useQuery({
    queryKey: ['team-conversation-insights'],
    queryFn: () => ConversationIntelligenceService.getTeamConversationInsights(),
  });

  // Fetch sentiment trends
  const { data: sentimentTrends = [] } = useQuery({
    queryKey: ['sentiment-trends', startDate, endDate],
    queryFn: () => ConversationIntelligenceService.getSentimentTrends(startDate, endDate, 'day'),
  });

  // Fetch keyword trends
  const { data: keywordTrends = [] } = useQuery({
    queryKey: ['keyword-trends', startDate, endDate],
    queryFn: () => ConversationIntelligenceService.getKeywordTrends(startDate, endDate),
  });

  // Fetch call outcomes
  const { data: outcomeBreakdown = [] } = useQuery({
    queryKey: ['call-outcomes', startDate, endDate],
    queryFn: () => ConversationIntelligenceService.getCallOutcomesBreakdown(startDate, endDate),
  });

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!callAnalytics.length) {
      return {
        totalCalls: 0,
        avgSentiment: 0,
        positiveRate: 0,
        avgScriptAdherence: 0,
        complianceKeywords: 0,
        prohibitedKeywords: 0,
        avgTalkRatio: 0,
      };
    }

    const totalCalls = callAnalytics.length;
    const sentimentScores = callAnalytics.filter(c => c.sentiment_score != null).map(c => c.sentiment_score!);
    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
      : 0;

    const positiveCalls = callAnalytics.filter(c => c.overall_sentiment === 'positive').length;
    const positiveRate = (positiveCalls / totalCalls) * 100;

    const adherenceScores = callAnalytics.filter(c => c.script_adherence_score != null).map(c => c.script_adherence_score!);
    const avgScriptAdherence = adherenceScores.length > 0
      ? adherenceScores.reduce((a, b) => a + b, 0) / adherenceScores.length
      : 0;

    const complianceKeywords = callAnalytics.reduce((sum, c) => sum + (c.compliance_keywords_found || 0), 0);
    const prohibitedKeywords = callAnalytics.reduce((sum, c) => sum + (c.prohibited_keywords_found || 0), 0);

    const talkRatios = callAnalytics.filter(c => c.talk_to_listen_ratio != null).map(c => c.talk_to_listen_ratio!);
    const avgTalkRatio = talkRatios.length > 0
      ? talkRatios.reduce((a, b) => a + b, 0) / talkRatios.length
      : 0;

    return {
      totalCalls,
      avgSentiment,
      positiveRate,
      avgScriptAdherence,
      complianceKeywords,
      prohibitedKeywords,
      avgTalkRatio,
    };
  }, [callAnalytics]);

  // Sentiment distribution for pie chart
  const sentimentDistribution = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    callAnalytics.forEach(c => {
      if (c.overall_sentiment) {
        counts[c.overall_sentiment]++;
      }
    });
    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [callAnalytics]);

  // Get unique teams
  const teams = useMemo(() => {
    const teamSet = new Set<string>();
    agentInsights.forEach(i => { if (i.team) teamSet.add(i.team); });
    return Array.from(teamSet);
  }, [agentInsights]);

  if (analyticsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <p className="text-sm text-muted-foreground">Loading analytics data...</p>
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-orange-500" />
        <div className="text-center">
          <h3 className="font-semibold text-lg">Unable to load analytics</h3>
          <p className="text-sm text-muted-foreground">
            The call_analytics table may not exist yet. Please run the database migration.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Conversation Intelligence</h2>
          <p className="text-muted-foreground">
            AI-powered insights from {stats.totalCalls} calls
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(team => (
                <SelectItem key={team} value={team}>{team}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-xs">Total Calls</span>
            </div>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ThumbsUp className="h-4 w-4" />
              <span className="text-xs">Positive Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-500">{stats.positiveRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs">Avg Sentiment</span>
            </div>
            <div className={`text-2xl font-bold ${stats.avgSentiment >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.avgSentiment >= 0 ? '+' : ''}{stats.avgSentiment.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs">Script Adherence</span>
            </div>
            <div className="text-2xl font-bold">{stats.avgScriptAdherence.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Compliance</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">{stats.complianceKeywords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <XCircle className="h-4 w-4" />
              <span className="text-xs">Violations</span>
            </div>
            <div className={`text-2xl font-bold ${stats.prohibitedKeywords > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {stats.prohibitedKeywords}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Talk:Listen</span>
            </div>
            <div className="text-2xl font-bold">{stats.avgTalkRatio.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="calls">Recent Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Sentiment Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sentiment Trend</CardTitle>
                <CardDescription>Daily sentiment distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={sentimentTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => format(new Date(v), 'MMM d')}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip
                      labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="positive"
                      stackId="1"
                      fill={SENTIMENT_COLORS.positive}
                      stroke={SENTIMENT_COLORS.positive}
                    />
                    <Area
                      type="monotone"
                      dataKey="neutral"
                      stackId="1"
                      fill={SENTIMENT_COLORS.neutral}
                      stroke={SENTIMENT_COLORS.neutral}
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      stackId="1"
                      fill={SENTIMENT_COLORS.negative}
                      stroke={SENTIMENT_COLORS.negative}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Sentiment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sentiment Distribution</CardTitle>
                <CardDescription>Overall call sentiment breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={sentimentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {sentimentDistribution.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Call Outcomes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Call Outcomes</CardTitle>
                <CardDescription>How calls are being resolved</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={outcomeBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="outcome"
                      width={120}
                      fontSize={11}
                      tickFormatter={(v) => v.replace(/_/g, ' ')}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {outcomeBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Team Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Performance</CardTitle>
                <CardDescription>Conversation metrics by team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {teamInsights.map((team) => (
                    <div key={team.team} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{team.team}</span>
                          <Badge variant="secondary">{team.agent_count} agents</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {team.total_calls_30d} calls
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Sentiment:</span>
                          <span className={`ml-1 font-medium ${(team.avg_sentiment || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {(team.avg_sentiment || 0).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Script:</span>
                          <span className="ml-1 font-medium">{(team.avg_script_adherence || 0).toFixed(0)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Violations:</span>
                          <span className={`ml-1 font-medium ${(team.total_violations || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {team.total_violations || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {teamInsights.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No team data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Score Trend</CardTitle>
              <CardDescription>Average daily sentiment score over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sentimentTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => format(new Date(v), 'MMM d')}
                    fontSize={12}
                  />
                  <YAxis domain={[-1, 1]} fontSize={12} />
                  <Tooltip
                    labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                    formatter={(value: number) => [value.toFixed(2), 'Avg Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {keywordTrends.map((category) => (
              <Card key={category.category}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize flex items-center gap-2">
                    {category.category === 'compliance' && <Shield className="h-4 w-4 text-blue-500" />}
                    {category.category === 'prohibited' && <XCircle className="h-4 w-4 text-red-500" />}
                    {category.category === 'empathy' && <Heart className="h-4 w-4 text-pink-500" />}
                    {category.category === 'escalation' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                    {category.category} Keywords
                  </CardTitle>
                  <CardDescription>Total: {category.total} occurrences</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {category.phrases.slice(0, 5).map((phrase, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm">{phrase.phrase}</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={(phrase.count / category.total) * 100}
                            className="w-20 h-2"
                          />
                          <span className="text-sm text-muted-foreground w-12 text-right">
                            {phrase.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Conversation Insights</CardTitle>
              <CardDescription>30-day conversation metrics by agent</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Sentiment</TableHead>
                    <TableHead className="text-right">Script %</TableHead>
                    <TableHead className="text-right">Compliance</TableHead>
                    <TableHead className="text-right">Violations</TableHead>
                    <TableHead className="text-right">Empathy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentInsights.slice(0, 20).map((agent) => (
                    <TableRow key={agent.agent_id}>
                      <TableCell className="font-medium">
                        {agent.first_name} {agent.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{agent.team || 'Unassigned'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{agent.total_calls_30d}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${(agent.avg_sentiment_score || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {(agent.avg_sentiment_score || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.avg_script_adherence?.toFixed(0) || '-'}%
                      </TableCell>
                      <TableCell className="text-right text-blue-500">
                        {agent.total_compliance_keywords || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={(agent.total_prohibited_keywords || 0) > 0 ? 'text-red-500 font-medium' : 'text-green-500'}>
                          {agent.total_prohibited_keywords || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-pink-500">
                        {agent.total_empathy_keywords || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Call Analytics</CardTitle>
              <CardDescription>Latest analyzed calls</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead>Script</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callAnalytics.slice(0, 20).map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="text-sm">
                        {format(new Date(call.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        {call.agent ? `${call.agent.first_name} ${call.agent.last_name}` : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {call.call_duration_seconds
                          ? `${Math.floor(call.call_duration_seconds / 60)}:${(call.call_duration_seconds % 60).toString().padStart(2, '0')}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {call.overall_sentiment === 'positive' && <ThumbsUp className="h-4 w-4 text-green-500" />}
                          {call.overall_sentiment === 'negative' && <ThumbsDown className="h-4 w-4 text-red-500" />}
                          {call.overall_sentiment === 'neutral' && <Minus className="h-4 w-4 text-yellow-500" />}
                          {call.overall_sentiment === 'mixed' && <TrendingDown className="h-4 w-4 text-purple-500" />}
                          <span className="text-sm">{call.sentiment_score?.toFixed(2) || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {call.script_adherence_score != null ? (
                          <span className={call.script_adherence_score >= 70 ? 'text-green-500' : 'text-red-500'}>
                            {call.script_adherence_score.toFixed(0)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {call.call_outcome ? (
                          <Badge variant="outline" className="text-xs">
                            {call.call_outcome.replace(/_/g, ' ')}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {call.prohibited_keywords_found > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {call.prohibited_keywords_found} violation{call.prohibited_keywords_found !== 1 ? 's' : ''}
                            </Badge>
                          )}
                          {call.escalation_triggers_found > 0 && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                              Escalation
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
