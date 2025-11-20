export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      approved_time_off: {
        Row: {
          created_at: string;
          days_taken: number;
          end_date: string;
          hourly_rate: number | null;
          id: string;
          request_id: string | null;
          request_type: string;
          start_date: string;
          total_pay: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_taken: number;
          end_date: string;
          hourly_rate?: number | null;
          id?: string;
          request_id?: string | null;
          request_type: string;
          start_date: string;
          total_pay?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          days_taken?: number;
          end_date?: string;
          hourly_rate?: number | null;
          id?: string;
          request_id?: string | null;
          request_type?: string;
          start_date?: string;
          total_pay?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approved_time_off_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "time_off_requests";
            referencedColumns: ["id"];
          }
        ];
      };
      early_clock_attempts: {
        Row: {
          actual_clock_in: string | null;
          attempted_time: string;
          created_at: string;
          id: string;
          scheduled_start: string;
          status: string;
          user_id: string;
          team: string;
        };
        Insert: {
          actual_clock_in?: string | null;
          attempted_time?: string;
          created_at?: string;
          id?: string;
          scheduled_start: string;
          status?: string;
          user_id: string;
          team: string;
        };
        Update: {
          actual_clock_in?: string | null;
          attempted_time?: string;
          created_at?: string;
          id?: string;
          scheduled_start?: string;
          status?: string;
          user_id?: string;
          team?: string;
        };
        Relationships: [];
      };
      employee_shifts: {
        Row: {
          afternoon_end: string | null;
          afternoon_start: string | null;
          created_at: string;
          day_of_week: number;
          id: string;
          is_working_day: boolean | null;
          morning_end: string | null;
          morning_start: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          afternoon_end?: string | null;
          afternoon_start?: string | null;
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_working_day?: boolean | null;
          morning_end?: string | null;
          morning_start?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          afternoon_end?: string | null;
          afternoon_start?: string | null;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_working_day?: boolean | null;
          morning_end?: string | null;
          morning_start?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "employee_shifts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      holidays: {
        Row: {
          created_at: string;
          holiday_date: string;
          holiday_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          holiday_date: string;
          holiday_name: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          holiday_date?: string;
          holiday_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      kpis: {
        Row: {
          bonus_amount: number | null;
          created_at: string;
          id: string;
          metric_name: string;
          metric_value: number;
          period_end: string;
          period_start: string;
          user_id: string;
        };
        Insert: {
          bonus_amount?: number | null;
          created_at?: string;
          id?: string;
          metric_name: string;
          metric_value: number;
          period_end: string;
          period_start: string;
          user_id: string;
        };
        Update: {
          bonus_amount?: number | null;
          created_at?: string;
          id?: string;
          metric_name?: string;
          metric_value?: number;
          period_end?: string;
          period_start?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pay_periods: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          period_type: string;
          start_date: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          period_type: string;
          start_date: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          period_type?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payroll_calculations: {
        Row: {
          created_at: string;
          holiday_hours: number;
          holiday_pay: number;
          hourly_rate: number;
          id: string;
          overtime_hours: number;
          overtime_pay: number;
          pay_period_id: string;
          pto_hours: number;
          pto_pay: number;
          regular_hours: number;
          regular_pay: number;
          total_gross_pay: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          holiday_hours?: number;
          holiday_pay?: number;
          hourly_rate: number;
          id?: string;
          overtime_hours?: number;
          overtime_pay?: number;
          pay_period_id: string;
          pto_hours?: number;
          pto_pay?: number;
          regular_hours?: number;
          regular_pay?: number;
          total_gross_pay?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          holiday_hours?: number;
          holiday_pay?: number;
          hourly_rate?: number;
          id?: string;
          overtime_hours?: number;
          overtime_pay?: number;
          pay_period_id?: string;
          pto_hours?: number;
          pto_pay?: number;
          regular_hours?: number;
          regular_pay?: number;
          total_gross_pay?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_calculations_pay_period_id_fkey";
            columns: ["pay_period_id"];
            isOneToOne: false;
            referencedRelation: "pay_periods";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          birthday: string | null;
          created_at: string;
          email: string;
          first_name: string | null;
          hourly_rate: number;
          id: string;
          last_name: string | null;
          pto_rule: string | null;
          role: Database["public"]["Enums"]["app_role"];
          start_date: string | null;
          team: string | null;
          updated_at: string;
          uto_rule: string | null;
        };
        Insert: {
          birthday?: string | null;
          created_at?: string;
          email: string;
          first_name?: string | null;
          hourly_rate?: number;
          id: string;
          last_name?: string | null;
          pto_rule?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          start_date?: string | null;
          team?: string | null;
          updated_at?: string;
          uto_rule?: string | null;
        };
        Update: {
          birthday?: string | null;
          created_at?: string;
          email?: string;
          first_name?: string | null;
          hourly_rate?: number;
          id?: string;
          last_name?: string | null;
          pto_rule?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          start_date?: string | null;
          team?: string | null;
          updated_at?: string;
          uto_rule?: string | null;
        };
        Relationships: [];
      };
      time_corrections: {
        Row: {
          approval_notes: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          id: string;
          requested_start_time: string | null;
          reason: string;
          requested_end_time: string | null;
          team: string | null;
          status: string;
          time_entry_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approval_notes?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          requested_start_time?: string | null;
          reason: string;
          requested_end_time?: string | null;
          team?: string | null;
          status?: string;
          time_entry_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approval_notes?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          original_end_time?: string;
          reason?: string;
          requested_end_time?: string;
          status?: string;
          time_entry_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          created_at: string;
          end_time: string | null;
          id: string;
          start_time: string;
          status: string;
          total_hours: number | null;
          updated_at: string;
          user_id: string;
          team: string;
        };
        Insert: {
          created_at?: string;
          end_time?: string | null;
          id?: string;
          start_time: string;
          status?: string;
          total_hours?: number | null;
          updated_at?: string;
          user_id: string;
          team: string;
        };
        Update: {
          created_at?: string;
          end_time?: string | null;
          id?: string;
          start_time?: string;
          status?: string;
          total_hours?: number | null;
          updated_at?: string;
          user_id?: string;
          team?: string;
        };
        Relationships: [];
      };
      time_off_requests: {
        Row: {
          approval_notes: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          days_requested: number;
          end_date: string;
          id: string;
          reason: string | null;
          request_type: string;
          start_date: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          approval_notes?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          days_requested: number;
          end_date: string;
          id?: string;
          reason?: string | null;
          request_type: string;
          start_date: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          approval_notes?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          days_requested?: number;
          end_date?: string;
          id?: string;
          reason?: string | null;
          request_type?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      time_off_taken: {
        Row: {
          created_at: string;
          days_taken: number;
          end_date: string;
          id: string;
          notes: string | null;
          request_id: string | null;
          start_date: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days_taken: number;
          end_date: string;
          id?: string;
          notes?: string | null;
          request_id?: string | null;
          start_date: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          days_taken?: number;
          end_date?: string;
          id?: string;
          notes?: string | null;
          request_id?: string | null;
          start_date?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      time_off_rules: {
        Row: {
          id: string;
          name: string;
          value: number;
          reset_period: number;
          reset_unit: Database["public"]["Enums"]["rule_unit"];
          not_before: number;
          not_before_unit: Database["public"]["Enums"]["rule_unit"];
          team: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_time_correction: {
        Args: { correction_id: string; approver_id: string; notes?: string };
        Returns: boolean;
      };
      approve_time_off_request: {
        Args: { request_id: string; approver_id: string };
        Returns: boolean;
      };
      auto_end_shift: {
        Args: { user_id_param: string; time_entry_id_param: string };
        Returns: boolean;
      };
      calculate_payroll_for_period: {
        Args: { pay_period_id_param: string };
        Returns: undefined;
      };
      deny_time_off_request: {
        Args: { request_id: string; approver_id: string };
        Returns: boolean;
      };
      generate_pay_periods_for_year: {
        Args: { year_param: number };
        Returns: undefined;
      };
      get_user_roles: {
        Args: { target_user_id?: string };
        Returns: Database["public"]["Enums"]["app_role"][];
      };
      has_any_role: {
        Args: {
          target_roles: Database["public"]["Enums"]["app_role"][];
          target_user_id?: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"];
          target_user_id?: string;
        };
        Returns: boolean;
      };
      reset_quarterly_uto_balances: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      get_profile_with_time_off_balance: {
        Args: { target_user_id: string };
        Returns: {
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
        };
      };
    };
    Enums: {
      app_role: "admin" | "manager" | "ccm" | "crm";
      rule_unit: "DAY" | "MONTH" | "YEAR"; //TODO: When we handle pregancy time off we will need to include HOUR since they get 10 hours for doctor appointments
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
    public: {
        Enums: {
            app_role: ["admin", "manager", "ccm", "crm"],
        },
    },
  } as const;
