import { supabase } from '@/integrations/supabase/client';

export interface CompanySetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  updated_at: string;
}

export interface CompanySettings {
  company_name: string;
  timezone: string;
  pay_period_type: 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly';
  pay_period_start_day: number;
  overtime_threshold: number;
  overtime_multiplier: number;
  require_company_network: boolean;
  allowed_ip_addresses: string[];
  require_scheduled_shift: boolean;
  break_tracking_enabled: boolean;
  auto_clock_out_hours: number;
  // AI Settings
  ai_provider: 'openai' | 'lmstudio' | 'local';
  ai_api_key: string;
  ai_endpoint: string;
  ai_model: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: 'Cliopa.io',
  timezone: 'America/Los_Angeles',
  pay_period_type: 'semi_monthly',
  pay_period_start_day: 8,
  overtime_threshold: 40,
  overtime_multiplier: 1.5,
  require_company_network: false,
  allowed_ip_addresses: [],
  require_scheduled_shift: false,
  break_tracking_enabled: false,
  auto_clock_out_hours: 12,
  // AI defaults
  ai_provider: 'openai',
  ai_api_key: '',
  ai_endpoint: 'http://localhost:1234/v1',
  ai_model: 'gpt-4o-mini',
};

// Service to get user's public IP address
export const NetworkService = {
  async getPublicIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get public IP:', error);
      return null;
    }
  },

  async isOnAllowedNetwork(allowedIPs: string[]): Promise<{ allowed: boolean; currentIP: string | null }> {
    const currentIP = await this.getPublicIP();
    if (!currentIP) {
      return { allowed: false, currentIP: null };
    }
    const allowed = allowedIPs.length === 0 || allowedIPs.includes(currentIP);
    return { allowed, currentIP };
  },
};

export const SettingsService = {
  // Get all settings as a typed object
  async getSettings(): Promise<CompanySettings> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*');

    if (error) {
      console.error('Error fetching settings:', error);
      return DEFAULT_SETTINGS;
    }

    const settings: CompanySettings = { ...DEFAULT_SETTINGS };

    (data || []).forEach((row: CompanySetting) => {
      const key = row.setting_key as keyof CompanySettings;
      if (key in settings) {
        try {
          settings[key] = typeof row.setting_value === 'string'
            ? JSON.parse(row.setting_value)
            : row.setting_value;
        } catch {
          settings[key] = row.setting_value;
        }
      }
    });

    return settings;
  },

  // Update a single setting
  async updateSetting(key: string, value: any): Promise<void> {
    const { error } = await supabase
      .from('company_settings')
      .update({
        setting_value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('setting_key', key);

    if (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  },

  // Update multiple settings at once
  async updateSettings(settings: Partial<CompanySettings>): Promise<void> {
    const updates = Object.entries(settings).map(([key, value]) =>
      supabase
        .from('company_settings')
        .update({
          setting_value: JSON.stringify(value),
          updated_at: new Date().toISOString(),
          updated_by: (supabase.auth.getUser() as any)?.data?.user?.id,
        })
        .eq('setting_key', key)
    );

    await Promise.all(updates);
  },
};
