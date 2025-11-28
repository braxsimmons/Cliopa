import { useState, useEffect, useMemo, useRef } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  isSameMonth,
  isSameDay,
  parseISO,
  getDay,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Trash2,
  Upload,
  Repeat,
  Download,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { SchedulingService, ScheduledShift, CreateShiftInput } from '@/services/SchedulingService';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  team: string | null;
}

interface RecurringOptions {
  enabled: boolean;
  weeks: number;
  days: number[]; // 0 = Sunday, 1 = Monday, etc.
}

interface CSVShift {
  employee_email: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  shift_type?: string;
  team?: string;
  notes?: string;
  valid: boolean;
  error?: string;
  employee_id?: string;
}

const SHIFT_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'overtime', label: 'Overtime' },
  { value: 'training', label: 'Training' },
  { value: 'meeting', label: 'Meeting' },
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-gray-400',
  no_show: 'bg-red-500',
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export const ShiftScheduler = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState<ScheduledShift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedShift, setSelectedShift] = useState<ScheduledShift | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateShiftInput>({
    user_id: '',
    scheduled_date: '',
    start_time: '09:00',
    end_time: '17:00',
    shift_type: 'regular',
    team: '',
    notes: '',
  });
  const [recurringOptions, setRecurringOptions] = useState<RecurringOptions>({
    enabled: false,
    weeks: 4,
    days: [],
  });
  const [saving, setSaving] = useState(false);
  const [csvShifts, setCsvShifts] = useState<CSVShift[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Fetch shifts and employees
  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const [shiftsData, employeesData] = await Promise.all([
        SchedulingService.getShiftsForRange(monthStart, monthEnd),
        SchedulingService.getEmployees(),
      ]);

      setShifts(shiftsData);
      setEmployees(employeesData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load schedule data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledShift[]> = {};
    shifts.forEach((shift) => {
      const dateKey = shift.scheduled_date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(shift);
    });
    return grouped;
  }, [shifts]);

  // Calendar generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dayOfWeek = getDay(date);
    setFormData({
      ...formData,
      scheduled_date: format(date, 'yyyy-MM-dd'),
    });
    setRecurringOptions({
      enabled: false,
      weeks: 4,
      days: [dayOfWeek],
    });
    setIsAddDialogOpen(true);
  };

  const handleShiftClick = (shift: ScheduledShift, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedShift(shift);
    setIsViewDialogOpen(true);
  };

  const handleAddShift = async () => {
    if (!formData.user_id) {
      toast({
        title: 'Error',
        description: 'Please select an employee',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (recurringOptions.enabled && recurringOptions.days.length > 0) {
        // Create recurring shifts
        const shiftsToCreate: CreateShiftInput[] = [];
        const startDate = selectedDate || new Date();

        for (let week = 0; week < recurringOptions.weeks; week++) {
          for (const dayOfWeek of recurringOptions.days) {
            // Find the date for this day of week in this week
            const weekStart = addWeeks(startOfWeek(startDate, { weekStartsOn: 0 }), week);
            const shiftDate = addDays(weekStart, dayOfWeek);

            // Only add if it's on or after the start date
            if (shiftDate >= startDate) {
              shiftsToCreate.push({
                ...formData,
                scheduled_date: format(shiftDate, 'yyyy-MM-dd'),
              });
            }
          }
        }

        if (shiftsToCreate.length > 0) {
          await SchedulingService.createBulkShifts(shiftsToCreate);
          toast({
            title: 'Success',
            description: `${shiftsToCreate.length} recurring shifts scheduled`,
          });
        }
      } else {
        // Create single shift
        await SchedulingService.createShift(formData);
        toast({
          title: 'Success',
          description: 'Shift scheduled successfully',
        });
      }

      setIsAddDialogOpen(false);
      fetchData();
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create shift(s)',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateShiftStatus = async (status: 'completed' | 'cancelled' | 'no_show') => {
    if (!selectedShift) return;

    setSaving(true);
    try {
      await SchedulingService.updateShift(selectedShift.id, { status });
      toast({
        title: 'Success',
        description: 'Shift status updated',
      });
      setIsViewDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update shift',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedShift) return;

    setSaving(true);
    try {
      await SchedulingService.deleteShift(selectedShift.id);
      toast({
        title: 'Success',
        description: 'Shift deleted',
      });
      setIsViewDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete shift',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      scheduled_date: '',
      start_time: '09:00',
      end_time: '17:00',
      shift_type: 'regular',
      team: '',
      notes: '',
    });
    setRecurringOptions({
      enabled: false,
      weeks: 4,
      days: [],
    });
  };

  const getEmployeeName = (shift: ScheduledShift) => {
    if (shift.first_name || shift.last_name) {
      return `${shift.first_name || ''} ${shift.last_name || ''}`.trim();
    }
    return shift.email || 'Unknown';
  };

  // CSV Import Functions
  const downloadCSVTemplate = () => {
    const headers = ['employee_email', 'scheduled_date', 'start_time', 'end_time', 'shift_type', 'team', 'notes'];
    const exampleRow = ['john@example.com', '2024-12-15', '09:00', '17:00', 'regular', 'Sales', 'Morning shift'];
    const csv = [headers.join(','), exampleRow.join(',')].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shift_schedule_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): CSVShift[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const emailIndex = headers.indexOf('employee_email');
    const dateIndex = headers.indexOf('scheduled_date');
    const startIndex = headers.indexOf('start_time');
    const endIndex = headers.indexOf('end_time');
    const typeIndex = headers.indexOf('shift_type');
    const teamIndex = headers.indexOf('team');
    const notesIndex = headers.indexOf('notes');

    if (emailIndex === -1 || dateIndex === -1 || startIndex === -1 || endIndex === -1) {
      return [];
    }

    const parsed: CSVShift[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const email = values[emailIndex];
      const employee = employees.find(e => e.email?.toLowerCase() === email?.toLowerCase());

      let valid = true;
      let error = '';

      if (!email) {
        valid = false;
        error = 'Missing email';
      } else if (!employee) {
        valid = false;
        error = 'Employee not found';
      }

      const dateStr = values[dateIndex];
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        valid = false;
        error = error || 'Invalid date format (use YYYY-MM-DD)';
      }

      const startTime = values[startIndex];
      const endTime = values[endIndex];
      if (!startTime || !endTime) {
        valid = false;
        error = error || 'Missing start or end time';
      }

      parsed.push({
        employee_email: email,
        scheduled_date: dateStr,
        start_time: startTime,
        end_time: endTime,
        shift_type: typeIndex !== -1 ? values[typeIndex] || 'regular' : 'regular',
        team: teamIndex !== -1 ? values[teamIndex] : undefined,
        notes: notesIndex !== -1 ? values[notesIndex] : undefined,
        valid,
        error,
        employee_id: employee?.id,
      });
    }

    return parsed;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setCsvShifts(parsed);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportShifts = async () => {
    const validShifts = csvShifts.filter(s => s.valid && s.employee_id);
    if (validShifts.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid shifts to import',
        variant: 'destructive',
      });
      return;
    }

    setImportLoading(true);
    try {
      const shiftsToCreate: CreateShiftInput[] = validShifts.map(s => ({
        user_id: s.employee_id!,
        scheduled_date: s.scheduled_date,
        start_time: s.start_time,
        end_time: s.end_time,
        shift_type: s.shift_type,
        team: s.team,
        notes: s.notes,
      }));

      await SchedulingService.createBulkShifts(shiftsToCreate);

      toast({
        title: 'Success',
        description: `${shiftsToCreate.length} shifts imported successfully`,
      });

      setIsImportDialogOpen(false);
      setCsvShifts([]);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to import shifts',
        variant: 'destructive',
      });
    } finally {
      setImportLoading(false);
    }
  };

  const toggleRecurringDay = (day: number) => {
    setRecurringOptions(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day].sort((a, b) => a - b),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const validShiftsCount = csvShifts.filter(s => s.valid).length;
  const invalidShiftsCount = csvShifts.filter(s => !s.valid).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Shift Scheduler</h1>
          <p className="text-[var(--color-subtext)]">Schedule and manage employee shifts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
            className="border-[var(--color-border)] text-[var(--color-text)]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <div className="flex items-center">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold text-[var(--color-text)] min-w-[180px] text-center">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', color)} />
            <span className="text-sm text-[var(--color-subtext)] capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-[var(--color-subtext)] py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayShifts = shiftsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(day)}
                  className={cn(
                    'min-h-[120px] p-2 border rounded-lg cursor-pointer transition-colors',
                    isCurrentMonth
                      ? 'bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
                      : 'bg-[var(--color-surface)] border-transparent opacity-50',
                    isToday && 'ring-2 ring-[var(--color-accent)]'
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isCurrentMonth ? 'text-[var(--color-text)]' : 'text-[var(--color-subtext)]',
                        isToday && 'text-[var(--color-accent)]'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayShifts.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayShifts.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayShifts.slice(0, 3).map((shift) => (
                      <div
                        key={shift.id}
                        onClick={(e) => handleShiftClick(shift, e)}
                        className={cn(
                          'text-xs p-1 rounded truncate text-white',
                          STATUS_COLORS[shift.status]
                        )}
                      >
                        {getEmployeeName(shift)}
                      </div>
                    ))}
                    {dayShifts.length > 3 && (
                      <div className="text-xs text-[var(--color-subtext)]">
                        +{dayShifts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Shift Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">
              Schedule Shift - {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div>
              <Label className="text-[var(--color-text)]">Employee</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name || emp.last_name
                        ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                        : emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--color-text)]">Start Time</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
                />
              </div>
              <div>
                <Label className="text-[var(--color-text)]">End Time</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
                />
              </div>
            </div>

            <div>
              <Label className="text-[var(--color-text)]">Shift Type</Label>
              <Select
                value={formData.shift_type}
                onValueChange={(value) => setFormData({ ...formData, shift_type: value })}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {SHIFT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[var(--color-text)]">Team</Label>
              <Input
                value={formData.team || ''}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                placeholder="e.g., Sales, Support"
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>

            <div>
              <Label className="text-[var(--color-text)]">Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes..."
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>

            {/* Recurring Shift Options */}
            <div className="border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-[var(--color-accent)]" />
                  <Label className="text-[var(--color-text)] font-medium">Recurring Shift</Label>
                </div>
                <Switch
                  checked={recurringOptions.enabled}
                  onCheckedChange={(checked) => setRecurringOptions(prev => ({ ...prev, enabled: checked }))}
                />
              </div>

              {recurringOptions.enabled && (
                <div className="space-y-4 pl-6">
                  <div>
                    <Label className="text-[var(--color-text)] text-sm">Repeat on these days:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleRecurringDay(day.value)}
                          className={cn(
                            'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                            recurringOptions.days.includes(day.value)
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]'
                          )}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[var(--color-text)] text-sm">For how many weeks?</Label>
                    <Select
                      value={recurringOptions.weeks.toString()}
                      onValueChange={(value) => setRecurringOptions(prev => ({ ...prev, weeks: parseInt(value) }))}
                    >
                      <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                        {[1, 2, 3, 4, 6, 8, 12].map((weeks) => (
                          <SelectItem key={weeks} value={weeks.toString()}>
                            {weeks} week{weeks > 1 ? 's' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {recurringOptions.days.length > 0 && (
                    <p className="text-xs text-[var(--color-subtext)]">
                      This will create approximately {recurringOptions.days.length * recurringOptions.weeks} shifts
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddShift}
              disabled={saving}
              className="bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90"
            >
              {saving ? <LoadingSpinner size="sm" /> : recurringOptions.enabled ? 'Schedule Recurring' : 'Schedule Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Shift Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Shift Details</DialogTitle>
          </DialogHeader>
          {selectedShift && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-medium">
                  {getEmployeeName(selectedShift).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-[var(--color-text)]">
                    {getEmployeeName(selectedShift)}
                  </p>
                  <p className="text-sm text-[var(--color-subtext)]">{selectedShift.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[var(--color-subtext)]" />
                  <span className="text-[var(--color-text)]">
                    {format(parseISO(selectedShift.scheduled_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[var(--color-subtext)]" />
                  <span className="text-[var(--color-text)]">
                    {selectedShift.start_time.slice(0, 5)} - {selectedShift.end_time.slice(0, 5)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className={cn('text-white', STATUS_COLORS[selectedShift.status])}>
                  {selectedShift.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">{selectedShift.shift_type}</Badge>
                {selectedShift.team && <Badge variant="secondary">{selectedShift.team}</Badge>}
              </div>

              {selectedShift.notes && (
                <div className="p-3 bg-[var(--color-bg)] rounded-lg">
                  <p className="text-sm text-[var(--color-text)]">{selectedShift.notes}</p>
                </div>
              )}

              {selectedShift.status === 'scheduled' && (
                <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--color-border)]">
                  <Button
                    size="sm"
                    onClick={() => handleUpdateShiftStatus('completed')}
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    Mark Completed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateShiftStatus('no_show')}
                    disabled={saving}
                    className="border-red-500 text-red-500 hover:bg-red-50"
                  >
                    No Show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateShiftStatus('cancelled')}
                    disabled={saving}
                    className="border-[var(--color-border)] text-[var(--color-subtext)]"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteShift}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Import Shifts from CSV</DialogTitle>
            <DialogDescription className="text-[var(--color-subtext)]">
              Upload a CSV file to bulk import shift schedules
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Download */}
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg)] rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-[var(--color-accent)]" />
                <div>
                  <p className="font-medium text-[var(--color-text)]">CSV Template</p>
                  <p className="text-sm text-[var(--color-subtext)]">Download the template to get started</p>
                </div>
              </div>
              <Button variant="outline" onClick={downloadCSVTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {/* File Upload */}
            <div>
              <Label className="text-[var(--color-text)]">Upload CSV File</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] mt-1"
              />
            </div>

            {/* Preview */}
            {csvShifts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">{validShiftsCount} valid</span>
                  </div>
                  {invalidShiftsCount > 0 && (
                    <div className="flex items-center gap-2 text-red-500">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">{invalidShiftsCount} invalid</span>
                    </div>
                  )}
                </div>

                <div className="max-h-[200px] overflow-y-auto border border-[var(--color-border)] rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-bg)] sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-[var(--color-text)]">Status</th>
                        <th className="text-left p-2 text-[var(--color-text)]">Employee</th>
                        <th className="text-left p-2 text-[var(--color-text)]">Date</th>
                        <th className="text-left p-2 text-[var(--color-text)]">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvShifts.map((shift, idx) => (
                        <tr key={idx} className={cn('border-t border-[var(--color-border)]', !shift.valid && 'bg-red-50 dark:bg-red-950/20')}>
                          <td className="p-2">
                            {shift.valid ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <span className="text-xs text-red-500">{shift.error}</span>
                            )}
                          </td>
                          <td className="p-2 text-[var(--color-text)]">{shift.employee_email}</td>
                          <td className="p-2 text-[var(--color-text)]">{shift.scheduled_date}</td>
                          <td className="p-2 text-[var(--color-text)]">{shift.start_time} - {shift.end_time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsImportDialogOpen(false);
                setCsvShifts([]);
              }}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportShifts}
              disabled={importLoading || validShiftsCount === 0}
              className="bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90"
            >
              {importLoading ? <LoadingSpinner size="sm" /> : `Import ${validShiftsCount} Shifts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
