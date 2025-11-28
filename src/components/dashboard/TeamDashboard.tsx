import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { Users, Clock, UserCheck, UserX, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ActiveEmployee {
  id: string;
  user_id: string;
  start_time: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  team: string | null;
  shift_type: string | null;
}

export const TeamDashboard = () => {
  const [activeEmployees, setActiveEmployees] = useState<ActiveEmployee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchActiveEmployees();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchActiveEmployees, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEmployees = async () => {
    try {
      // Get active time entries (clocked in but not clocked out)
      const { data: activeEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select(`
          id,
          user_id,
          start_time,
          shift_type,
          profiles:user_id (
            first_name,
            last_name,
            email,
            team
          )
        `)
        .is('end_time', null)
        .order('start_time', { ascending: false });

      if (entriesError) throw entriesError;

      // Get total employee count
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const mapped = (activeEntries || []).map((entry: any) => ({
        id: entry.id,
        user_id: entry.user_id,
        start_time: entry.start_time,
        shift_type: entry.shift_type,
        first_name: entry.profiles?.first_name,
        last_name: entry.profiles?.last_name,
        email: entry.profiles?.email || '',
        team: entry.profiles?.team,
      }));

      setActiveEmployees(mapped);
      setTotalEmployees(count || 0);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching active employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (emp: ActiveEmployee) => {
    if (emp.first_name || emp.last_name) {
      return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
    }
    return emp.email?.split('@')[0] || 'Unknown';
  };

  const getTimeWorked = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const minutes = differenceInMinutes(now, start);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const clockedInPercent = totalEmployees > 0
    ? Math.round((activeEmployees.length / totalEmployees) * 100)
    : 0;

  if (loading) {
    return (
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Status
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchActiveEmployees}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4 text-[var(--color-subtext)]" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-[var(--color-bg)] rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <UserCheck className="h-4 w-4" />
              <span className="text-lg font-bold">{activeEmployees.length}</span>
            </div>
            <p className="text-xs text-[var(--color-subtext)]">Clocked In</p>
          </div>
          <div className="text-center p-3 bg-[var(--color-bg)] rounded-lg">
            <div className="flex items-center justify-center gap-1 text-[var(--color-subtext)] mb-1">
              <UserX className="h-4 w-4" />
              <span className="text-lg font-bold">{totalEmployees - activeEmployees.length}</span>
            </div>
            <p className="text-xs text-[var(--color-subtext)]">Not Working</p>
          </div>
          <div className="text-center p-3 bg-[var(--color-bg)] rounded-lg">
            <div className="flex items-center justify-center gap-1 text-[var(--color-accent)] mb-1">
              <span className="text-lg font-bold">{clockedInPercent}%</span>
            </div>
            <p className="text-xs text-[var(--color-subtext)]">Active</p>
          </div>
        </div>

        {/* Active Employees List */}
        {activeEmployees.length === 0 ? (
          <div className="text-center py-6">
            <UserX className="h-8 w-8 mx-auto text-[var(--color-subtext)] mb-2" />
            <p className="text-sm text-[var(--color-subtext)]">
              No one is currently clocked in
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[var(--color-subtext)] mb-2">Currently Working:</p>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {activeEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2 bg-[var(--color-bg)] rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-medium">
                      {getEmployeeName(emp).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text)]">
                        {getEmployeeName(emp)}
                      </p>
                      <div className="flex items-center gap-2">
                        {emp.team && (
                          <span className="text-xs text-[var(--color-subtext)]">{emp.team}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-green-600">
                      <Clock className="h-3 w-3" />
                      <span className="text-xs font-medium">{getTimeWorked(emp.start_time)}</span>
                    </div>
                    <p className="text-xs text-[var(--color-subtext)]">
                      since {format(new Date(emp.start_time), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <p className="text-xs text-[var(--color-subtext)] text-center mt-4">
          Last updated: {format(lastRefresh, 'h:mm:ss a')}
        </p>
      </CardContent>
    </Card>
  );
};
