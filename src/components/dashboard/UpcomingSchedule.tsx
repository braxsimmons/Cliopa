import { useState, useEffect } from 'react';
import { format, parseISO, addDays, isToday, isTomorrow } from 'date-fns';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/useAuth';
import { SchedulingService, ScheduledShift } from '@/services/SchedulingService';
import { cn } from '@/lib/utils';

export const UpcomingSchedule = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUpcomingShifts();
    }
  }, [user?.id]);

  const fetchUpcomingShifts = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const twoWeeksFromNow = format(addDays(new Date(), 14), 'yyyy-MM-dd');

      const data = await SchedulingService.getShiftsForUser(user.id, today, twoWeeksFromNow);
      setShifts(data.filter(s => s.status === 'scheduled'));
    } catch (error) {
      console.error('Error fetching upcoming shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMM d');
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            My Upcoming Shifts
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
        <CardTitle className="text-sm font-medium text-[var(--color-text)] flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          My Upcoming Shifts
          {shifts.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {shifts.length} scheduled
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="h-8 w-8 mx-auto text-[var(--color-subtext)] mb-2" />
            <p className="text-sm text-[var(--color-subtext)]">
              No upcoming shifts scheduled
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shifts.slice(0, 5).map((shift) => (
              <div
                key={shift.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  isToday(parseISO(shift.scheduled_date))
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]'
                    : 'bg-[var(--color-bg)] border-[var(--color-border)]'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      isToday(parseISO(shift.scheduled_date))
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text)]'
                    )}>
                      {getDateLabel(shift.scheduled_date)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-[var(--color-subtext)]" />
                      <span className="text-sm text-[var(--color-subtext)]">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {shift.shift_type && (
                      <Badge variant="outline" className="text-xs">
                        {shift.shift_type}
                      </Badge>
                    )}
                    {shift.team && (
                      <Badge variant="secondary" className="text-xs">
                        {shift.team}
                      </Badge>
                    )}
                  </div>
                </div>
                {shift.notes && (
                  <p className="text-xs text-[var(--color-subtext)] mt-2 line-clamp-1">
                    {shift.notes}
                  </p>
                )}
              </div>
            ))}
            {shifts.length > 5 && (
              <p className="text-xs text-center text-[var(--color-subtext)]">
                +{shifts.length - 5} more shifts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
