export interface TimeEntry {
  id: string;
  start_time: string;
  end_time: string | null;
  total_hours: number | null;
  status: string;
  user_id: string;
  team: string;
  shift_type: string;
}
