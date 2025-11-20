import { supabase } from "@/integrations/supabase/client";

export interface Call {
  id: string;
  user_id: string;
  call_id?: string;
  campaign_name?: string;
  call_type?: string;
  call_start_time?: string;
  call_end_time?: string;
  call_duration_seconds?: number;
  recording_url?: string;
  transcript_text?: string;
  transcript_url?: string;
  customer_phone?: string;
  customer_name?: string;
  disposition?: string;
  status: 'pending' | 'transcribed' | 'audited' | 'failed';
  audit_id?: string;
  created_at: string;
  updated_at: string;
}

// Get all calls for user
export const CallsSelectForUser = async (userId: string) => {
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("user_id", userId)
    .order("call_start_time", { ascending: false });

  return { calls: data, error };
};

// Get all calls (manager view)
export const CallsSelectAll = async () => {
  const { data, error } = await supabase
    .from("calls")
    .select(`
      *,
      profiles:user_id (
        first_name,
        last_name,
        email,
        team
      )
    `)
    .order("call_start_time", { ascending: false });

  return { calls: data, error };
};

// Get calls by status
export const CallsSelectByStatus = async (
  status: 'pending' | 'transcribed' | 'audited' | 'failed'
) => {
  const { data, error } = await supabase
    .from("calls")
    .select(`
      *,
      profiles:user_id (
        first_name,
        last_name,
        email,
        team
      )
    `)
    .eq("status", status)
    .order("call_start_time", { ascending: false });

  return { calls: data, error };
};

// Insert new call
export const CallsInsert = async (call: Partial<Call>) => {
  const { data, error } = await supabase
    .from("calls")
    .insert(call)
    .select()
    .single();

  return { call: data, error };
};

// Update call status
export const CallsUpdateStatus = async (
  callId: string,
  status: 'pending' | 'transcribed' | 'audited' | 'failed',
  auditId?: string
) => {
  const updateData: any = { status };
  if (auditId) {
    updateData.audit_id = auditId;
  }

  const { data, error } = await supabase
    .from("calls")
    .update(updateData)
    .eq("id", callId)
    .select()
    .single();

  return { call: data, error };
};

// Get call by ID
export const CallsSelectById = async (id: string) => {
  const { data, error } = await supabase
    .from("calls")
    .select(`
      *,
      profiles:user_id (
        first_name,
        last_name,
        email,
        team
      )
    `)
    .eq("id", id)
    .single();

  return { call: data, error };
};
