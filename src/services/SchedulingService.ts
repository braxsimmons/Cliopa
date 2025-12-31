import { supabase } from '@/integrations/supabase/client';

export interface ScheduledShift {
  id: string;
  user_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  team: string | null;
  notes: string | null;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  batch_id?: string | null; // For tracking recurring shift batches
  // Joined from profiles
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface CreateShiftInput {
  user_id: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  shift_type?: string;
  team?: string;
  notes?: string;
}

export interface UpdateShiftInput {
  scheduled_date?: string;
  start_time?: string;
  end_time?: string;
  shift_type?: string;
  team?: string;
  notes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
}

export const SchedulingService = {
  // Get all scheduled shifts for a date range
  async getShiftsForRange(startDate: string, endDate: string, userId?: string): Promise<ScheduledShift[]> {
    let query = supabase
      .from('scheduled_shifts')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate)
      .order('scheduled_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching scheduled shifts:', error);
      throw error;
    }

    return (data || []).map((shift: any) => ({
      ...shift,
      first_name: shift.profiles?.first_name,
      last_name: shift.profiles?.last_name,
      email: shift.profiles?.email,
    }));
  },

  // Get shifts for a specific user
  async getShiftsForUser(userId: string, startDate?: string, endDate?: string): Promise<ScheduledShift[]> {
    let query = supabase
      .from('scheduled_shifts')
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true });

    if (startDate) {
      query = query.gte('scheduled_date', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user shifts:', error);
      throw error;
    }

    return (data || []).map((shift: any) => ({
      ...shift,
      first_name: shift.profiles?.first_name,
      last_name: shift.profiles?.last_name,
      email: shift.profiles?.email,
    }));
  },

  // Create a new scheduled shift
  async createShift(input: CreateShiftInput): Promise<ScheduledShift> {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('scheduled_shifts')
      .insert({
        ...input,
        created_by: user?.id,
      })
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error creating shift:', error);
      throw error;
    }

    return {
      ...data,
      first_name: data.profiles?.first_name,
      last_name: data.profiles?.last_name,
      email: data.profiles?.email,
    };
  },

  // Update an existing shift
  async updateShift(shiftId: string, input: UpdateShiftInput): Promise<ScheduledShift> {
    const { data, error } = await supabase
      .from('scheduled_shifts')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shiftId)
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `)
      .single();

    if (error) {
      console.error('Error updating shift:', error);
      throw error;
    }

    return {
      ...data,
      first_name: data.profiles?.first_name,
      last_name: data.profiles?.last_name,
      email: data.profiles?.email,
    };
  },

  // Delete a shift
  async deleteShift(shiftId: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_shifts')
      .delete()
      .eq('id', shiftId);

    if (error) {
      console.error('Error deleting shift:', error);
      throw error;
    }
  },

  // Bulk create shifts (for recurring schedules)
  async createBulkShifts(shifts: CreateShiftInput[]): Promise<{ shifts: ScheduledShift[]; batchId: string }> {
    const { data: { user } } = await supabase.auth.getUser();

    // Generate a unique batch_id for this recurring schedule
    const batchId = crypto.randomUUID();

    const shiftsWithCreator = shifts.map(shift => ({
      ...shift,
      created_by: user?.id,
      batch_id: batchId,
    }));

    const { data, error } = await supabase
      .from('scheduled_shifts')
      .insert(shiftsWithCreator)
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name,
          email
        )
      `);

    if (error) {
      console.error('Error creating bulk shifts:', error);
      throw error;
    }

    const createdShifts = (data || []).map((shift: any) => ({
      ...shift,
      first_name: shift.profiles?.first_name,
      last_name: shift.profiles?.last_name,
      email: shift.profiles?.email,
    }));

    return { shifts: createdShifts, batchId };
  },

  // Delete all shifts in a batch (for undoing recurring schedules)
  async deleteBatch(batchId: string): Promise<number> {
    const { data, error } = await supabase
      .from('scheduled_shifts')
      .delete()
      .eq('batch_id', batchId)
      .select('id');

    if (error) {
      console.error('Error deleting batch:', error);
      throw error;
    }

    return data?.length || 0;
  },

  // Get count of shifts in a batch
  async getBatchCount(batchId: string): Promise<number> {
    const { count, error } = await supabase
      .from('scheduled_shifts')
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);

    if (error) {
      console.error('Error counting batch:', error);
      throw error;
    }

    return count || 0;
  },

  // Get all employees (for the scheduler dropdown)
  async getEmployees(): Promise<{ id: string; first_name: string; last_name: string; email: string; team: string | null }[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, team')
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }

    return data || [];
  },
};
