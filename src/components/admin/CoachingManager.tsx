import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Plus,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Target,
  Video,
  ChevronRight,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { CoachingService, CoachingSession, AgentGoal } from '@/services/CoachingService';
import { useAuth } from '@/hooks/useAuth';
import { format, addDays, startOfWeek, endOfWeek, isToday, isFuture, isPast } from 'date-fns';

const SESSION_TYPES = [
  { value: 'one_on_one', label: '1:1 Coaching', icon: Users },
  { value: 'performance_review', label: 'Performance Review', icon: Target },
  { value: 'skill_development', label: 'Skill Development', icon: MessageSquare },
  { value: 'self_review', label: 'Self Review', icon: CheckCircle2 },
];

const STATUS_COLORS = {
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300',
  no_show: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export const CoachingManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<CoachingSession[]>([]);
  const [goals, setGoals] = useState<AgentGoal[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string; team?: string }[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // New session form
  const [newSession, setNewSession] = useState({
    agent_id: '',
    session_type: 'one_on_one',
    title: '',
    description: '',
    scheduled_at: '',
    duration_minutes: 30,
  });

  const fetchData = useCallback(async () => {
    try {
      const [sessionsData, goalsData] = await Promise.all([
        CoachingService.getCoachingSessions(
          selectedAgent !== 'all' ? { agentId: selectedAgent } : undefined
        ),
        CoachingService.getAgentGoals(
          selectedAgent !== 'all' ? { agentId: selectedAgent } : undefined
        ),
      ]);

      setSessions(sessionsData);
      setGoals(goalsData);

      // Extract unique agents
      const uniqueAgents = new Map<string, { id: string; name: string; team?: string }>();
      sessionsData.forEach((s) => {
        if (s.agent && !uniqueAgents.has(s.agent_id)) {
          uniqueAgents.set(s.agent_id, {
            id: s.agent_id,
            name: `${s.agent.first_name} ${s.agent.last_name}`,
            team: s.agent.team,
          });
        }
      });
      setAgents(Array.from(uniqueAgents.values()));
    } catch (error) {
      console.error('Error fetching coaching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load coaching data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSession = async () => {
    if (!newSession.agent_id || !newSession.title || !newSession.scheduled_at) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      await CoachingService.createCoachingSession({
        ...newSession,
        coach_id: user?.id,
      } as Partial<CoachingSession>);

      toast({
        title: 'Session Scheduled',
        description: 'Coaching session has been scheduled successfully',
      });

      setShowNewSession(false);
      setNewSession({
        agent_id: '',
        session_type: 'one_on_one',
        title: '',
        description: '',
        scheduled_at: '',
        duration_minutes: 30,
      });
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create coaching session',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateStatus = async (sessionId: string, status: string) => {
    try {
      await CoachingService.updateCoachingSession(sessionId, {
        status: status as CoachingSession['status'],
        completed_at: status === 'completed' ? new Date().toISOString() : undefined,
      });

      toast({
        title: 'Status Updated',
        description: `Session marked as ${status}`,
      });

      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update session status',
        variant: 'destructive',
      });
    }
  };

  // Group sessions by date
  const upcomingSessions = sessions
    .filter((s) => s.status === 'scheduled' && isFuture(new Date(s.scheduled_at)))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const todaySessions = sessions.filter(
    (s) => isToday(new Date(s.scheduled_at)) && s.status !== 'cancelled'
  );

  const pastSessions = sessions
    .filter((s) => isPast(new Date(s.scheduled_at)) || s.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, 20);

  const activeGoals = goals.filter((g) => g.status === 'active');

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
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Agent Coaching</h1>
          <p className="text-[var(--color-subtext)]">Schedule and manage coaching sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-48 bg-[var(--color-surface)] border-[var(--color-border)]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Agents" />
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

          <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-[var(--color-surface)]">
              <DialogHeader>
                <DialogTitle className="text-[var(--color-text)]">Schedule Coaching Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label className="text-[var(--color-text)]">Agent *</Label>
                  <Select
                    value={newSession.agent_id}
                    onValueChange={(value) => setNewSession({ ...newSession, agent_id: value })}
                  >
                    <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name} {agent.team && `(${agent.team})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[var(--color-text)]">Session Type *</Label>
                  <Select
                    value={newSession.session_type}
                    onValueChange={(value) => setNewSession({ ...newSession, session_type: value })}
                  >
                    <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[var(--color-text)]">Title *</Label>
                  <Input
                    value={newSession.title}
                    onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                    placeholder="e.g., Weekly Performance Review"
                    className="bg-[var(--color-bg)] border-[var(--color-border)]"
                  />
                </div>

                <div>
                  <Label className="text-[var(--color-text)]">Description</Label>
                  <Textarea
                    value={newSession.description}
                    onChange={(e) => setNewSession({ ...newSession, description: e.target.value })}
                    placeholder="Agenda or notes for the session..."
                    className="bg-[var(--color-bg)] border-[var(--color-border)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[var(--color-text)]">Date & Time *</Label>
                    <Input
                      type="datetime-local"
                      value={newSession.scheduled_at}
                      onChange={(e) => setNewSession({ ...newSession, scheduled_at: e.target.value })}
                      className="bg-[var(--color-bg)] border-[var(--color-border)]"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--color-text)]">Duration (min)</Label>
                    <Select
                      value={String(newSession.duration_minutes)}
                      onValueChange={(value) => setNewSession({ ...newSession, duration_minutes: parseInt(value) })}
                    >
                      <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">60 min</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowNewSession(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateSession}>
                    Schedule Session
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Today's Sessions */}
      {todaySessions.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Today's Sessions ({todaySessions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaySessions.map((session) => (
                <div key={session.id} className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-[var(--color-surface)] shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--color-text)]">{session.title}</p>
                      <Badge className={STATUS_COLORS[session.status]}>{session.status}</Badge>
                    </div>
                    <p className="text-sm text-[var(--color-subtext)] mt-1">
                      {session.agent?.first_name} {session.agent?.last_name} •{' '}
                      {format(new Date(session.scheduled_at), 'h:mm a')} •{' '}
                      {session.duration_minutes} min
                    </p>
                  </div>
                  {session.status === 'scheduled' && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(session.id, 'in_progress')}
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateStatus(session.id, 'no_show')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {session.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(session.id, 'completed')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="upcoming">
        <TabsList className="bg-[var(--color-surface)] border border-[var(--color-border)]">
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming ({upcomingSessions.length})
          </TabsTrigger>
          <TabsTrigger value="goals" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
            <Target className="h-4 w-4 mr-2" />
            Active Goals ({activeGoals.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-[var(--color-accent)] data-[state=active]:text-white">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardContent className="pt-6">
              {upcomingSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-4" />
                  <p className="text-[var(--color-text)] font-medium">No upcoming sessions</p>
                  <p className="text-sm text-[var(--color-subtext)]">Schedule a coaching session to get started</p>
                  <Button className="mt-4" onClick={() => setShowNewSession(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 p-4 rounded-lg bg-[var(--color-bg)]">
                      <div className="w-14 text-center">
                        <p className="text-2xl font-bold text-[var(--color-text)]">
                          {format(new Date(session.scheduled_at), 'd')}
                        </p>
                        <p className="text-xs text-[var(--color-subtext)]">
                          {format(new Date(session.scheduled_at), 'MMM')}
                        </p>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[var(--color-text)]">{session.title}</p>
                        <p className="text-sm text-[var(--color-subtext)]">
                          {session.agent?.first_name} {session.agent?.last_name}
                          {session.agent?.team && ` • ${session.agent.team}`}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-subtext)]">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(session.scheduled_at), 'h:mm a')}
                          </span>
                          <span>{session.duration_minutes} min</span>
                          <Badge variant="outline" className="text-xs">
                            {SESSION_TYPES.find((t) => t.value === session.session_type)?.label}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardContent className="pt-6">
              {activeGoals.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-4" />
                  <p className="text-[var(--color-text)] font-medium">No active goals</p>
                  <p className="text-sm text-[var(--color-subtext)]">Create goals for agents to track their progress</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeGoals.map((goal) => {
                    const progress = (goal.current_value / goal.target_value) * 100;
                    const daysLeft = Math.ceil(
                      (new Date(goal.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div key={goal.id} className="p-4 rounded-lg bg-[var(--color-bg)]">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-[var(--color-text)]">{goal.title}</p>
                            <p className="text-sm text-[var(--color-subtext)]">
                              {goal.agent?.first_name} {goal.agent?.last_name}
                            </p>
                          </div>
                          <Badge
                            className={
                              goal.priority === 'high'
                                ? 'bg-red-100 text-red-700'
                                : goal.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                            }
                          >
                            {goal.priority}
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-[var(--color-subtext)]">
                              {goal.current_value} / {goal.target_value}{' '}
                              {goal.metric_type === 'percentage' ? '%' : goal.metric_type === 'score' ? 'pts' : ''}
                            </span>
                            <span className={`font-medium ${daysLeft < 7 ? 'text-orange-500' : 'text-[var(--color-text)]'}`}>
                              {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                            </span>
                          </div>
                          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all bg-[var(--color-accent)]"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardContent className="pt-6">
              {pastSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-[var(--color-subtext)] mx-auto mb-4" />
                  <p className="text-[var(--color-text)] font-medium">No past sessions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastSessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-4 p-4 rounded-lg bg-[var(--color-bg)]">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[var(--color-text)]">{session.title}</p>
                          <Badge className={STATUS_COLORS[session.status]}>{session.status}</Badge>
                        </div>
                        <p className="text-sm text-[var(--color-subtext)] mt-1">
                          {session.agent?.first_name} {session.agent?.last_name} •{' '}
                          {format(new Date(session.scheduled_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                      {session.rating && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-[var(--color-accent)]">
                            {session.rating}/5
                          </p>
                          <p className="text-xs text-[var(--color-subtext)]">Rating</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
