export interface EmployeeData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number;
  start_date: string | null;
  birthday: string | null;
  team: string | null;
  role: string | null;
  uto_name: string | null;
  max_uto: number | null;
  pending_uto_request: number | null;
  available_uto: number | null;
  pto_name: string | null;
  max_pto: number | null;
  pending_pto_request: number | null;
  available_pto: number | null;
  time_off_start_date_pto: string | null;
  time_off_end_date_pto: string | null;
  time_off_start_date_uto: string | null;
  time_off_end_date_uto: string | null;
  pto_rule_advance_at: string | null;
  employment_type: string;
}

export interface ShiftData {
  day_of_week: number;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
  is_working_day: boolean;
}

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const TEAM_OPTIONS = ["bisongreen", "boost", "support staff"];

export const EMPLOYMENT_TYPE = ["Full-Time", "Part-Time"];
