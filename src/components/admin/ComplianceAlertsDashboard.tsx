import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Bell,
  BellOff,
  Clock,
  Phone,
  User,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  Search,
  TrendingUp,
  TrendingDown,
  Volume2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeService } from '@/services/RealtimeService';
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
} from 'recharts';

interface ComplianceAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata: Record<string, any>;
  is_read: boolean;
  is_acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
  agent?: { first_name: string; last_name: string; team?: string };
}

interface ConversationAnalysis {
  id: string;
  call_id: string;
  compliance_score: number;
  prohibited_keywords_found: { phrase: string; count: number; context: string }[];
  missing_required_phrases: string[];
  script_adherence_score: number;
  empathy_score: number;
  sentiment: { overall: string; agent: string; customer: string };
  created_at: string;
  call?: {
    id: string;
    call_date: string;
    duration_seconds: number;
    agent_name: string;
    disposition: string;
  };
  agent?: { first_name: string; last_name: string; team?: string };
}

interface ReportCard {
  id: string;
  user_id: string;
  call_id: string;
  overall_score: number;
  compliance_score: number;
  created_at: string;
  feedback?: string;
  agent?: { first_name: string; last_name: string; team?: string };
  call?: { call_date: string; duration_seconds: number };
}

const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-100 dark:bg-red-950/30', border: 'border-red-300 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  warning: { bg: 'bg-yellow-100 dark:bg-yellow-950/30', border: 'border-yellow-300 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400' },
  info: { bg: 'bg-blue-100 dark:bg-blue-950/30', border: 'border-blue-300 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
  success: { bg: 'bg-green-100 dark:bg-green-950/30', border: 'border-green-300 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
};

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

export const ComplianceAlertsDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [violations, setViolations] = useState<ConversationAnalysis[]>([]);
  const [lowScoreCards, setLowScoreCards] = useState<ReportCard[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showAcknowledged, setShowAcknowledged] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch compliance-related alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('performance_alerts')
        .select(`
          *,
          agent:user_id (first_name, last_name, team)
        `)
        .in('alert_type', ['compliance_violation', 'low_score', 'score_drop'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      // Fetch conversation analyses with violations
      const { data: violationsData, error: violationsError } = await supabase
        .from('conversation_analyses')
        .select(`
          *,
          call:call_id (id, call_date, duration_seconds, agent_name, disposition),
          agent:call_id->user_id (first_name, last_name, team)
        `)
        .or('compliance_score.lt.70,prohibited_keywords_found.neq.[]')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!violationsError) {
        setViolations(violationsData || []);
      }

      // Fetch low compliance report cards
      const { data: lowScores, error: scoresError } = await supabase
        .from('report_cards')
        .select(`
          *,
          agent:user_id (first_name, last_name, team),
          call:call_id (call_date, duration_seconds)
        `)
        .lt('compliance_score', 75)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!scoresError) {
        setLowScoreCards(lowScores || []);
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load compliance data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time subscription for new alerts
  useEffect(() => {
    const channel = supabase
      .channel('compliance-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'performance_alerts' },
        (payload: any) => {
          if (['compliance_violation', 'low_score', 'score_drop'].includes(payload.new.alert_type)) {
            setAlerts((prev) => [payload.new, ...prev].slice(0, 100));

            // Play sound for critical alerts
            if (soundEnabled && payload.new.severity === 'critical') {
              playAlertSound();
            }

            // Show toast for new alerts
            toast({
              title: payload.new.title,
              description: payload.new.message,
              variant: payload.new.severity === 'critical' ? 'destructive' : 'default',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [soundEnabled, toast]);

  const playAlertSound = () => {
    // Create a simple beep sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Could not play alert sound');
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('performance_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_by: user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() } : a
        )
      );

      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been acknowledged',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (!showAcknowledged && alert.is_acknowledged) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterType !== 'all' && alert.alert_type !== filterType) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        alert.title.toLowerCase().includes(search) ||
        alert.message.toLowerCase().includes(search) ||
        alert.agent?.first_name?.toLowerCase().includes(search) ||
        alert.agent?.last_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // Calculate stats
  const stats = {
    criticalCount: alerts.filter((a) => a.severity === 'critical' && !a.is_acknowledged).length,
    warningCount: alerts.filter((a) => a.severity === 'warning' && !a.is_acknowledged).length,
    totalViolations: violations.length,
    averageComplianceScore: violations.length
      ? Math.round(violations.reduce((acc, v) => acc + (v.compliance_score || 0), 0) / violations.length)
      : 0,
    prohibitedKeywordsFound: violations.reduce(
      (acc, v) => acc + (v.prohibited_keywords_found?.length || 0),
      0
    ),
  };

  // Chart data for severity distribution
  const severityData = [
    { name: 'Critical', value: alerts.filter((a) => a.severity === 'critical').length },
    { name: 'Warning', value: alerts.filter((a) => a.severity === 'warning').length },
    { name: 'Info', value: alerts.filter((a) => a.severity === 'info').length },
    { name: 'Success', value: alerts.filter((a) => a.severity === 'success').length },
  ].filter((d) => d.value > 0);

  // Chart data for alert types
  const alertTypeData = Object.entries(
    alerts.reduce((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({
    type: type.replace(/_/g, ' '),
    count,
  }));

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
            <ShieldAlert className="h-6 w-6 text-red-500" />
            Compliance Alerts
          </h1>
          <p className="text-[var(--color-subtext)]">Real-time compliance monitoring & violation tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="sound"
              checked={soundEnabled}
              onCheckedChange={setSoundEnabled}
            />
            <Label htmlFor="sound" className="text-sm text-[var(--color-subtext)] flex items-center gap-1">
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              Sound
            </Label>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {stats.criticalCount > 0 && (
        <div className="p-4 rounded-lg bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-800 flex items-center gap-4">
          <div className="p-2 rounded-full bg-red-500">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-red-700 dark:text-red-400">
              {stats.criticalCount} Critical Alert{stats.criticalCount > 1 ? 's' : ''} Require Attention
            </p>
            <p className="text-sm text-red-600 dark:text-red-500">
              These alerts indicate potential compliance violations that need immediate review.
            </p>
          </div>
          <Button variant="destructive" size="sm">
            Review Now
          </Button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`border-[var(--color-border)] ${stats.criticalCount > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-[var(--color-surface)]'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stats.criticalCount > 0 ? 'text-red-500' : 'text-[var(--color-subtext)]'}`} />
              <span className="text-xs text-[var(--color-subtext)]">Critical</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${stats.criticalCount > 0 ? 'text-red-500' : 'text-[var(--color-text)]'}`}>
              {stats.criticalCount}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-[var(--color-border)] ${stats.warningCount > 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-[var(--color-surface)]'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className={`h-4 w-4 ${stats.warningCount > 0 ? 'text-yellow-500' : 'text-[var(--color-subtext)]'}`} />
              <span className="text-xs text-[var(--color-subtext)]">Warnings</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${stats.warningCount > 0 ? 'text-yellow-500' : 'text-[var(--color-text)]'}`}>
              {stats.warningCount}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Violations Found</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.totalViolations}</p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Avg Compliance</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${
              stats.averageComplianceScore >= 80 ? 'text-green-500' :
              stats.averageComplianceScore >= 70 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              {stats.averageComplianceScore}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-[var(--color-subtext)]" />
              <span className="text-xs text-[var(--color-subtext)]">Prohibited Words</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{stats.prohibitedKeywordsFound}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts List */}
        <div className="lg:col-span-2">
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-[var(--color-text)]">Active Alerts</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-subtext)]" />
                    <Input
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-40 h-8 bg-[var(--color-bg)] border-[var(--color-border)]"
                    />
                  </div>
                  <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                    <SelectTrigger className="w-32 h-8 bg-[var(--color-bg)] border-[var(--color-border)]">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Switch
                      id="showAck"
                      checked={showAcknowledged}
                      onCheckedChange={setShowAcknowledged}
                    />
                    <Label htmlFor="showAck" className="text-xs text-[var(--color-subtext)]">
                      Show Ack'd
                    </Label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${SEVERITY_COLORS[alert.severity].bg} ${SEVERITY_COLORS[alert.severity].border} ${alert.is_acknowledged ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded ${
                          alert.severity === 'critical' ? 'bg-red-500' :
                          alert.severity === 'warning' ? 'bg-yellow-500' :
                          alert.severity === 'success' ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          {alert.severity === 'critical' ? (
                            <AlertTriangle className="h-4 w-4 text-white" />
                          ) : alert.severity === 'warning' ? (
                            <Shield className="h-4 w-4 text-white" />
                          ) : (
                            <Bell className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-medium ${SEVERITY_COLORS[alert.severity].text}`}>
                              {alert.title}
                            </p>
                            {!alert.is_read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                            {alert.is_acknowledged && (
                              <Badge variant="secondary" className="text-xs">Acknowledged</Badge>
                            )}
                          </div>
                          <p className="text-sm text-[var(--color-subtext)] mt-1">{alert.message}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-subtext)]">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {alert.agent?.first_name} {alert.agent?.last_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(alert.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!alert.is_acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ack
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredAlerts.length === 0 && (
                  <div className="text-center py-12">
                    <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <p className="text-[var(--color-text)] font-medium">All Clear!</p>
                    <p className="text-sm text-[var(--color-subtext)]">No alerts matching your filters</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Severity Distribution */}
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-text)] text-sm">Alert Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {severityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-[var(--color-subtext)]">
                  No alerts to display
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {severityData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1 text-xs">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-[var(--color-subtext)]">{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Violations */}
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-text)] text-sm">Recent Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {violations.slice(0, 5).map((violation) => (
                  <div key={violation.id} className="p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {violation.call?.agent_name || 'Unknown Agent'}
                      </span>
                      <Badge variant={violation.compliance_score < 60 ? 'destructive' : 'secondary'}>
                        {violation.compliance_score}%
                      </Badge>
                    </div>
                    {violation.prohibited_keywords_found?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-red-500 font-medium">Prohibited keywords:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {violation.prohibited_keywords_found.slice(0, 3).map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs text-red-500 border-red-300">
                              {kw.phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-[var(--color-subtext)] mt-2">
                      {new Date(violation.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {violations.length === 0 && (
                  <p className="text-center text-[var(--color-subtext)] py-4">No violations found</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Low Compliance Scores */}
          <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardHeader>
              <CardTitle className="text-[var(--color-text)] text-sm">Low Compliance Audits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {lowScoreCards.slice(0, 5).map((card) => (
                  <div key={card.id} className="flex items-center justify-between p-2 rounded bg-[var(--color-bg)]">
                    <div>
                      <p className="text-sm text-[var(--color-text)]">
                        {card.agent?.first_name} {card.agent?.last_name}
                      </p>
                      <p className="text-xs text-[var(--color-subtext)]">
                        {new Date(card.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="destructive">{card.compliance_score}%</Badge>
                  </div>
                ))}
                {lowScoreCards.length === 0 && (
                  <p className="text-center text-[var(--color-subtext)] py-4">
                    No low compliance scores
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
