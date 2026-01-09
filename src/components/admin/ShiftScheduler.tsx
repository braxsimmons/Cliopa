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
  subWeeks,
  isSameMonth,
  isSameDay,
  parseISO,
  getDay,
  getHours,
  setHours,
  eachHourOfInterval,
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
  Sun,
  Umbrella,
  Users,
  BarChart3,
  CalendarDays,
  Undo2,
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
import { ApprovedTimeOffSelectForRange } from '@/services/ApprovedTimeOffService';
import { cn } from '@/lib/utils';

type ViewMode = 'shifts' | 'timeoff' | 'both';
type CalendarMode = 'month' | 'week';
type WeekViewType = 'resource' | 'coverage';

// Time slots for coverage view (6am to 10pm)
const COVERAGE_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6, 7, 8, ... 22

interface TimeOffEntry {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_taken: number;
  request_type: 'PTO' | 'UTO';
}

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
  const [timeOffEntries, setTimeOffEntries] = useState<TimeOffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [weekViewType, setWeekViewType] = useState<WeekViewType>('resource');
  const [currentWeek, setCurrentWeek] = useState(new Date());
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
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Fetch shifts and employees
  useEffect(() => {
    fetchData();
  }, [currentMonth, currentWeek, calendarMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let rangeStart: string;
      let rangeEnd: string;

      if (calendarMode === 'week') {
        const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
        rangeStart = format(weekStart, 'yyyy-MM-dd');
        rangeEnd = format(weekEnd, 'yyyy-MM-dd');
      } else {
        rangeStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        rangeEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      }

      const [shiftsData, employeesData, timeOffData] = await Promise.all([
        SchedulingService.getShiftsForRange(rangeStart, rangeEnd),
        SchedulingService.getEmployees(),
        ApprovedTimeOffSelectForRange(rangeStart, rangeEnd),
      ]);

      setShifts(shiftsData);
      setEmployees(employeesData);
      setTimeOffEntries(timeOffData.data || []);
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

  // Group time off by date (expand date ranges)
  const timeOffByDate = useMemo(() => {
    const grouped: Record<string, TimeOffEntry[]> = {};
    timeOffEntries.forEach((entry) => {
      const startDate = parseISO(entry.start_date);
      const endDate = parseISO(entry.end_date);
      let currentDate = startDate;

      while (currentDate <= endDate) {
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(entry);
        currentDate = addDays(currentDate, 1);
      }
    });
    return grouped;
  }, [timeOffEntries]);

  // Get employee name from time off entry
  const getEmployeeNameById = (userId: string) => {
    const emp = employees.find(e => e.id === userId);
    if (emp) {
      return `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
    }
    return 'Unknown';
  };

  // Calendar generation for month view
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

  // Week days for week view
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [currentWeek]);

  // Calculate coverage for each hour/day slot (for coverage view)
  const coverageData = useMemo(() => {
    const coverage: Record<string, Record<number, number>> = {};

    weekDays.forEach((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      coverage[dateKey] = {};
      COVERAGE_HOURS.forEach((hour) => {
        coverage[dateKey][hour] = 0;
      });
    });

    shifts.forEach((shift) => {
      if (shift.status === 'cancelled') return;

      const startHour = parseInt(shift.start_time.split(':')[0]);
      const endHour = parseInt(shift.end_time.split(':')[0]);
      const dateKey = shift.scheduled_date;

      if (coverage[dateKey]) {
        for (let hour = startHour; hour < endHour && hour <= 22; hour++) {
          if (hour >= 6) {
            coverage[dateKey][hour] = (coverage[dateKey][hour] || 0) + 1;
          }
        }
      }
    });

    return coverage;
  }, [shifts, weekDays]);

  // Get coverage color based on count
  const getCoverageColor = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count < 3) return 'bg-red-200 text-red-800';
    if (count < 5) return 'bg-yellow-200 text-yellow-800';
    return 'bg-green-200 text-green-800';
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handlePrevWeek = () => setCurrentWeek(subWeeks(currentWeek, 1));
  const handleNextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));

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
          const { batchId } = await SchedulingService.createBulkShifts(shiftsToCreate);
          setLastBatchId(batchId);
          setShowUndoToast(true);

          // Auto-hide undo toast after 10 seconds
          setTimeout(() => {
            setShowUndoToast(false);
          }, 10000);

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

  // Undo batch creation
  const handleUndoBatch = async () => {
    if (!lastBatchId) return;

    try {
      const deletedCount = await SchedulingService.deleteBatch(lastBatchId);
      toast({
        title: 'Undone',
        description: `${deletedCount} recurring shifts deleted`,
      });
      setShowUndoToast(false);
      setLastBatchId(null);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to undo shift creation',
        variant: 'destructive',
      });
    }
  };

  // Delete all shifts in a batch (series)
  const handleDeleteSeries = async () => {
    if (!selectedShift?.batch_id) return;

    setSaving(true);
    try {
      const deletedCount = await SchedulingService.deleteBatch(selectedShift.batch_id);
      toast({
        title: 'Success',
        description: `${deletedCount} shifts in series deleted`,
      });
      setIsViewDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete shift series',
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

  // CSV Export Function
  const exportShiftsToCSV = () => {
    const headers = ['employee_email', 'employee_name', 'scheduled_date', 'start_time', 'end_time', 'shift_type', 'team', 'status', 'notes'];
    const rows = shifts.map(shift => [
      shift.email || '',
      `"${`${shift.first_name || ''} ${shift.last_name || ''}`.trim()}"`,
      shift.scheduled_date,
      shift.start_time,
      shift.end_time,
      shift.shift_type || 'regular',
      shift.team || '',
      shift.status,
      `"${(shift.notes || '').replace(/"/g, '""')}"`, // Escape quotes in notes
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = calendarMode === 'month'
      ? format(currentMonth, 'yyyy-MM')
      : format(startOfWeek(currentWeek, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    link.download = `shifts-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${shifts.length} shifts exported to CSV` });
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

  // Bulk selection functions
  const toggleShiftSelection = (shiftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedShiftIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shiftId)) {
        newSet.delete(shiftId);
      } else {
        newSet.add(shiftId);
      }
      return newSet;
    });
  };

  const selectAllShifts = () => {
    const scheduledShifts = shifts.filter(s => s.status === 'scheduled');
    setSelectedShiftIds(new Set(scheduledShifts.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedShiftIds(new Set());
  };

  const handleBulkStatusUpdate = async (status: 'completed' | 'cancelled' | 'no_show') => {
    if (selectedShiftIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const updatePromises = Array.from(selectedShiftIds).map(id =>
        SchedulingService.updateShift(id, { status })
      );
      await Promise.all(updatePromises);

      toast({
        title: 'Success',
        description: `${selectedShiftIds.size} shifts updated to ${status.replace('_', ' ')}`,
      });

      setIsBulkActionDialogOpen(false);
      setSelectedShiftIds(new Set());
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update some shifts',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedShiftIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const deletePromises = Array.from(selectedShiftIds).map(id =>
        SchedulingService.deleteShift(id)
      );
      await Promise.all(deletePromises);

      toast({
        title: 'Success',
        description: `${selectedShiftIds.size} shifts deleted`,
      });

      setIsBulkActionDialogOpen(false);
      setSelectedShiftIds(new Set());
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete some shifts',
        variant: 'destructive',
      });
    } finally {
      setBulkActionLoading(false);
    }
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
          <Button
            variant="outline"
            onClick={exportShiftsToCSV}
            disabled={shifts.length === 0}
            className="border-[var(--color-border)] text-[var(--color-text)]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          {/* Month/Week Toggle */}
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setCalendarMode('month')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                calendarMode === 'month'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
              )}
            >
              <Calendar className="h-4 w-4 inline mr-1" />
              Month
            </button>
            <button
              onClick={() => setCalendarMode('week')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors border-l border-[var(--color-border)]',
                calendarMode === 'week'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
              )}
            >
              <CalendarDays className="h-4 w-4 inline mr-1" />
              Week
            </button>
          </div>
          {/* Navigation */}
          <div className="flex items-center">
            <Button variant="outline" size="icon" onClick={calendarMode === 'month' ? handlePrevMonth : handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-semibold text-[var(--color-text)] min-w-[180px] text-center">
              {calendarMode === 'month'
                ? format(currentMonth, 'MMMM yyyy')
                : `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`}
            </span>
            <Button variant="outline" size="icon" onClick={calendarMode === 'month' ? handleNextMonth : handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Week View Type Toggle (only in week mode) */}
      {calendarMode === 'week' && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--color-subtext)]">View:</span>
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => setWeekViewType('resource')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1',
                weekViewType === 'resource'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
              )}
            >
              <Users className="h-4 w-4" />
              Resource
            </button>
            <button
              onClick={() => setWeekViewType('coverage')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors border-l border-[var(--color-border)] flex items-center gap-1',
                weekViewType === 'coverage'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
              )}
            >
              <BarChart3 className="h-4 w-4" />
              Coverage
            </button>
          </div>
        </div>
      )}

      {/* View Toggle (Shifts/Time Off/Both) */}
      <div className="flex items-center gap-4">
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setViewMode('shifts')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'shifts'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            )}
          >
            <Clock className="h-4 w-4 inline mr-1" />
            Shifts
          </button>
          <button
            onClick={() => setViewMode('timeoff')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-l border-r border-[var(--color-border)]',
              viewMode === 'timeoff'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            )}
          >
            <Sun className="h-4 w-4 inline mr-1" />
            Time Off
          </button>
          <button
            onClick={() => setViewMode('both')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              viewMode === 'both'
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            )}
          >
            Both
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {(viewMode === 'shifts' || viewMode === 'both') && Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', color)} />
            <span className="text-sm text-[var(--color-subtext)] capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
        {(viewMode === 'timeoff' || viewMode === 'both') && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-[var(--color-subtext)]">PTO</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm text-[var(--color-subtext)]">UTO</span>
            </div>
          </>
        )}
      </div>

      {/* Bulk Selection Bar */}
      {(viewMode === 'shifts' || viewMode === 'both') && (
        <div className="flex items-center justify-between p-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedShiftIds.size > 0 && selectedShiftIds.size === shifts.filter(s => s.status === 'scheduled').length}
                onCheckedChange={(checked) => {
                  if (checked) {
                    selectAllShifts();
                  } else {
                    clearSelection();
                  }
                }}
              />
              <span className="text-sm text-[var(--color-text)]">
                {selectedShiftIds.size > 0 ? `${selectedShiftIds.size} selected` : 'Select scheduled shifts'}
              </span>
            </div>
            {selectedShiftIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-[var(--color-subtext)]"
              >
                Clear
              </Button>
            )}
          </div>
          {selectedShiftIds.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleBulkStatusUpdate('completed')}
                disabled={bulkActionLoading}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkStatusUpdate('cancelled')}
                disabled={bulkActionLoading}
                className="border-[var(--color-border)] text-[var(--color-subtext)]"
              >
                Cancel All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsBulkActionDialogOpen(true)}
                disabled={bulkActionLoading}
                className="border-red-500 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Undo Banner for Recurring Shifts */}
      {showUndoToast && lastBatchId && (
        <div className="bg-blue-500 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            <span className="font-medium">Recurring shifts created</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUndoBatch}
            className="bg-white text-blue-500 hover:bg-blue-50"
          >
            Undo
          </Button>
        </div>
      )}

      {/* Month View - Calendar Grid */}
      {calendarMode === 'month' && (
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
                const dayTimeOff = timeOffByDate[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                // Filter based on view mode
                const showShifts = viewMode === 'shifts' || viewMode === 'both';
                const showTimeOff = viewMode === 'timeoff' || viewMode === 'both';

                // Calculate max items to show
                const totalItems = (showShifts ? dayShifts.length : 0) + (showTimeOff ? dayTimeOff.length : 0);

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
                      {totalItems > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {totalItems}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* Time Off entries (shown first) */}
                      {showTimeOff && dayTimeOff.slice(0, 2).map((timeOff, tIdx) => (
                        <div
                          key={`to-${timeOff.id}-${tIdx}`}
                          className={cn(
                            'text-xs p-1 rounded truncate text-white flex items-center gap-1',
                            timeOff.request_type === 'PTO' ? 'bg-purple-500' : 'bg-orange-500'
                          )}
                        >
                          {timeOff.request_type === 'PTO' ? (
                            <Sun className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <Umbrella className="h-3 w-3 flex-shrink-0" />
                          )}
                          <span className="truncate">{getEmployeeNameById(timeOff.user_id)}</span>
                        </div>
                      ))}
                      {/* Shift entries */}
                      {showShifts && dayShifts.slice(0, showTimeOff && dayTimeOff.length > 0 ? 1 : 3).map((shift) => (
                        <div
                          key={shift.id}
                          onClick={(e) => handleShiftClick(shift, e)}
                          className={cn(
                            'text-xs p-1 rounded truncate text-white flex items-center gap-1',
                            STATUS_COLORS[shift.status],
                            selectedShiftIds.has(shift.id) && 'ring-2 ring-offset-1 ring-[var(--color-accent)]'
                          )}
                        >
                          {shift.status === 'scheduled' && (
                            <Checkbox
                              checked={selectedShiftIds.has(shift.id)}
                              onCheckedChange={() => {}}
                              onClick={(e) => toggleShiftSelection(shift.id, e)}
                              className="h-3 w-3 border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-500"
                            />
                          )}
                          <span className="truncate">{getEmployeeName(shift)}</span>
                        </div>
                      ))}
                      {totalItems > 3 && (
                        <div className="text-xs text-[var(--color-subtext)]">
                          +{totalItems - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week View - Resource View */}
      {calendarMode === 'week' && weekViewType === 'resource' && (
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b border-[var(--color-border)] text-[var(--color-text)] min-w-[150px]">
                      Employee
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={format(day, 'yyyy-MM-dd')}
                        className={cn(
                          'text-center p-2 border-b border-[var(--color-border)] text-[var(--color-text)] min-w-[120px]',
                          isSameDay(day, new Date()) && 'bg-[var(--color-accent)]/10'
                        )}
                      >
                        <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                        <div className={cn(
                          'text-xs',
                          isSameDay(day, new Date()) ? 'text-[var(--color-accent)]' : 'text-[var(--color-subtext)]'
                        )}>
                          {format(day, 'MMM d')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-[var(--color-border)]">
                      <td className="p-2 text-[var(--color-text)]">
                        <div className="font-medium text-sm">
                          {emp.first_name || emp.last_name
                            ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
                            : emp.email}
                        </div>
                        {emp.team && (
                          <div className="text-xs text-[var(--color-subtext)]">{emp.team}</div>
                        )}
                      </td>
                      {weekDays.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const empShifts = (shiftsByDate[dateKey] || []).filter(s => s.user_id === emp.id);
                        const empTimeOff = (timeOffByDate[dateKey] || []).filter(t => t.user_id === emp.id);

                        return (
                          <td
                            key={dateKey}
                            onClick={() => handleDateClick(day)}
                            className={cn(
                              'p-1 text-center cursor-pointer hover:bg-[var(--color-bg)] transition-colors',
                              isSameDay(day, new Date()) && 'bg-[var(--color-accent)]/5'
                            )}
                          >
                            <div className="space-y-1">
                              {empTimeOff.map((to, idx) => (
                                <div
                                  key={`to-${to.id}-${idx}`}
                                  className={cn(
                                    'text-xs p-1 rounded text-white',
                                    to.request_type === 'PTO' ? 'bg-purple-500' : 'bg-orange-500'
                                  )}
                                >
                                  {to.request_type}
                                </div>
                              ))}
                              {empShifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  onClick={(e) => handleShiftClick(shift, e)}
                                  className={cn(
                                    'text-xs p-1 rounded text-white flex items-center gap-1',
                                    STATUS_COLORS[shift.status],
                                    selectedShiftIds.has(shift.id) && 'ring-2 ring-offset-1 ring-[var(--color-accent)]'
                                  )}
                                >
                                  {shift.status === 'scheduled' && (
                                    <Checkbox
                                      checked={selectedShiftIds.has(shift.id)}
                                      onCheckedChange={() => {}}
                                      onClick={(e) => toggleShiftSelection(shift.id, e)}
                                      className="h-3 w-3 border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-500"
                                    />
                                  )}
                                  <span>{shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week View - Coverage View */}
      {calendarMode === 'week' && weekViewType === 'coverage' && (
        <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-2 border-b border-[var(--color-border)] text-[var(--color-text)] min-w-[60px]">
                      Hour
                    </th>
                    {weekDays.map((day) => (
                      <th
                        key={format(day, 'yyyy-MM-dd')}
                        className={cn(
                          'text-center p-2 border-b border-[var(--color-border)] text-[var(--color-text)] min-w-[80px]',
                          isSameDay(day, new Date()) && 'bg-[var(--color-accent)]/10'
                        )}
                      >
                        <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                        <div className={cn(
                          'text-xs',
                          isSameDay(day, new Date()) ? 'text-[var(--color-accent)]' : 'text-[var(--color-subtext)]'
                        )}>
                          {format(day, 'MMM d')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COVERAGE_HOURS.map((hour) => (
                    <tr key={hour} className="border-b border-[var(--color-border)]">
                      <td className="p-2 text-sm text-[var(--color-text)]">
                        {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                      </td>
                      {weekDays.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const count = coverageData[dateKey]?.[hour] || 0;

                        return (
                          <td
                            key={`${dateKey}-${hour}`}
                            className={cn(
                              'p-2 text-center text-sm font-medium',
                              getCoverageColor(count)
                            )}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Coverage Legend */}
            <div className="flex items-center gap-4 mt-4 text-sm">
              <span className="text-[var(--color-subtext)]">Coverage:</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-200 rounded" />
                <span className="text-[var(--color-subtext)]">Low (&lt;3)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-200 rounded" />
                <span className="text-[var(--color-subtext)]">Medium (3-4)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-200 rounded" />
                <span className="text-[var(--color-subtext)]">Good (5+)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

              {/* Recurring Shift Indicator */}
              {selectedShift.batch_id && (
                <div className="flex items-center gap-2 text-[var(--color-subtext)] text-sm">
                  <Repeat className="h-4 w-4" />
                  <span>Part of a recurring schedule</span>
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
          <DialogFooter className="flex gap-2">
            {selectedShift?.batch_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSeries}
                disabled={saving}
                className="border-orange-500 text-orange-500 hover:bg-orange-50"
              >
                <Repeat className="h-4 w-4 mr-2" />
                Delete Series
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteShift}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete This Shift
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

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-text)]">Delete Selected Shifts</DialogTitle>
            <DialogDescription className="text-[var(--color-subtext)]">
              Are you sure you want to delete {selectedShiftIds.size} selected shift{selectedShiftIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkActionDialogOpen(false)}
              className="border-[var(--color-border)] text-[var(--color-text)]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? <LoadingSpinner size="sm" /> : `Delete ${selectedShiftIds.size} Shifts`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
