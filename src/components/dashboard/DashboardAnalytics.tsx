import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Calendar,
  TrendingUp,
  Award,
  Timer,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useWeeklyHours, WeeklyHoursEntry } from '@/hooks/useWeeklyHours';
import { useTimeTracking } from '@/hooks/useTimeTracking';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
  variant = 'default',
}) => {
  const variantStyles = {
    default: 'bg-[var(--color-surface)] border-[var(--color-border)]',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  };

  const iconStyles = {
    default: 'text-[var(--color-accent)]',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card className={cn('border', variantStyles[variant], className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--color-subtext)] uppercase tracking-wide">
              {title}
            </p>
            <p className="text-2xl font-bold text-[var(--color-text)]">{value}</p>
            {subtitle && (
              <p className="text-xs text-[var(--color-subtext)]">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp
                  className={cn(
                    'h-3 w-3',
                    trend.positive ? 'text-green-500' : 'text-red-500 rotate-180'
                  )}
                />
                <span
                  className={cn(
                    'text-xs font-medium',
                    trend.positive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {trend.positive ? '+' : ''}{trend.value}%
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-2 rounded-lg bg-[var(--color-bg)]', iconStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface PTOBalanceCardProps {
  title: string;
  available: number;
  max: number;
  pending: number;
  type: 'PTO' | 'UTO';
}

const PTOBalanceCard: React.FC<PTOBalanceCardProps> = ({
  title,
  available,
  max,
  pending,
  type,
}) => {
  const usedPercentage = max > 0 ? ((max - available) / max) * 100 : 0;
  const variant = type === 'PTO' ? 'text-blue-600' : 'text-purple-600';
  const progressColor = type === 'PTO' ? 'bg-blue-500' : 'bg-purple-500';

  return (
    <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className={cn('h-4 w-4', variant)} />
            <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {available} / {max} days
          </Badge>
        </div>
        <Progress
          value={usedPercentage}
          className="h-2 mb-2"
        />
        <div className="flex justify-between text-xs text-[var(--color-subtext)]">
          <span>Used: {(max - available).toFixed(1)} days</span>
          {pending > 0 && (
            <span className="text-yellow-600 dark:text-yellow-400">
              Pending: {pending} days
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const WeeklyHoursChart: React.FC<{ data: WeeklyHoursEntry | null }> = ({ data }) => {
  if (!data) {
    return (
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            This Week's Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-[var(--color-subtext)]">
            <p className="text-sm">No shift data for this week</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const days = [
    { name: 'Mon', hours: data.monday_hours },
    { name: 'Tue', hours: data.tuesday_hours },
    { name: 'Wed', hours: data.wednesday_hours },
    { name: 'Thu', hours: data.thursday_hours },
    { name: 'Fri', hours: data.friday_hours },
  ];

  const maxHours = Math.max(...days.map((d) => d.hours), 8);

  return (
    <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            This Week's Hours
          </CardTitle>
          <Badge variant={data.all_verified ? 'default' : 'secondary'}>
            {data.total_week_hours.toFixed(1)}h total
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-32">
          {days.map((day) => {
            const heightPercentage = maxHours > 0 ? (day.hours / maxHours) * 100 : 0;
            return (
              <div key={day.name} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-[var(--color-text)]">
                  {day.hours > 0 ? day.hours.toFixed(1) : '—'}
                </span>
                <div className="w-full bg-[var(--color-bg)] rounded-t-sm h-20 relative">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[var(--color-accent)] rounded-t-sm transition-all duration-500"
                    style={{ height: `${heightPercentage}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-subtext)]">{day.name}</span>
              </div>
            );
          })}
        </div>
        {!data.all_verified && data.unverified_ids.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400">
            <AlertCircle className="h-3 w-3" />
            <span>{data.unverified_ids.length} shift(s) pending verification</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const DashboardAnalytics: React.FC = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { entries, loading: hoursLoading } = useWeeklyHours();
  const { todayHours, isShiftActive } = useTimeTracking();

  const currentWeekData = entries.length > 0 ? entries[0] : null;
  const lastWeekData = entries.length > 1 ? entries[1] : null;

  // Calculate week-over-week change
  const weekOverWeekChange =
    lastWeekData && lastWeekData.total_week_hours > 0
      ? ((currentWeekData?.total_week_hours || 0) - lastWeekData.total_week_hours) /
        lastWeekData.total_week_hours *
        100
      : 0;

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  if (profileLoading || hoursLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-[var(--color-surface)] border-[var(--color-border)]">
            <CardContent className="p-4">
              <div className="h-16 bg-[var(--color-bg)] rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Hours"
          value={formatHours(todayHours)}
          subtitle={isShiftActive ? 'Currently clocked in' : 'Not clocked in'}
          icon={Timer}
          variant={isShiftActive ? 'success' : 'default'}
        />
        <StatCard
          title="This Week"
          value={`${(currentWeekData?.total_week_hours || 0).toFixed(1)}h`}
          subtitle="Total hours worked"
          icon={Clock}
          trend={
            weekOverWeekChange !== 0
              ? { value: Math.round(weekOverWeekChange), positive: weekOverWeekChange > 0 }
              : undefined
          }
        />
        <StatCard
          title="PTO Available"
          value={`${profile?.available_pto || 0} days`}
          subtitle={profile?.pending_pto_request ? `${profile.pending_pto_request} pending` : undefined}
          icon={CalendarCheck}
          variant={
            (profile?.available_pto || 0) < 2
              ? 'warning'
              : 'default'
          }
        />
        <StatCard
          title="UTO Available"
          value={`${profile?.available_uto || 0} days`}
          subtitle={profile?.pending_uto_request ? `${profile.pending_uto_request} pending` : undefined}
          icon={Calendar}
          variant={
            (profile?.available_uto || 0) < 1
              ? 'danger'
              : 'default'
          }
        />
      </div>

      {/* Weekly Hours Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeeklyHoursChart data={currentWeekData} />

        {/* PTO/UTO Balance Cards */}
        <div className="space-y-4">
          {profile?.max_pto && (
            <PTOBalanceCard
              title="PTO Balance"
              available={profile.available_pto || 0}
              max={profile.max_pto}
              pending={profile.pending_pto_request || 0}
              type="PTO"
            />
          )}
          {profile?.max_uto && (
            <PTOBalanceCard
              title="UTO Balance"
              available={profile.available_uto || 0}
              max={profile.max_uto}
              pending={profile.pending_uto_request || 0}
              type="UTO"
            />
          )}
          {!profile?.max_pto && !profile?.max_uto && (
            <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-[var(--color-subtext)]">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">No Time Off Rules Set</p>
                    <p className="text-xs">Contact your manager to set up PTO/UTO rules.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
