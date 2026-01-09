import { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Clock,
  DollarSign,
  Wifi,
  Save,
  RefreshCw,
  Plus,
  X,
  Globe,
  Brain,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { SettingsService, NetworkService, CompanySettings } from '@/services/SettingsService';
import { Badge } from '@/components/ui/badge';

const TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Phoenix', label: 'Arizona Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
];

const PAY_PERIOD_TYPES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'semi_monthly', label: 'Semi-Monthly (8th & 24th)' },
  { value: 'monthly', label: 'Monthly' },
];

const AI_PROVIDERS = [
  { value: 'openai', label: 'OpenAI', description: 'Cloud-based, requires API key' },
  { value: 'lmstudio', label: 'LM Studio', description: 'Local on-premise AI' },
];

const AI_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  lmstudio: [
    { value: 'local-model', label: 'Local Model (Auto-detect)' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
    { value: 'mistral-7b', label: 'Mistral 7B' },
    { value: 'phi-3', label: 'Phi-3' },
    { value: 'qwen-2.5-coder', label: 'Qwen 2.5 Coder' },
  ],
  local: [
    { value: 'local-model', label: 'Local Model (Auto-detect)' },
    { value: 'llama-3.1-8b', label: 'Llama 3.1 8B' },
    { value: 'mistral-7b', label: 'Mistral 7B' },
    { value: 'phi-3', label: 'Phi-3' },
    { value: 'qwen-2.5-coder', label: 'Qwen 2.5 Coder' },
  ],
};

export const CompanySettingsPage = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentIP, setCurrentIP] = useState<string | null>(null);
  const [newIP, setNewIP] = useState('');
  const [detectingIP, setDetectingIP] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    fetchSettings();
    detectCurrentIP();
  }, []);

  const detectCurrentIP = async () => {
    setDetectingIP(true);
    const ip = await NetworkService.getPublicIP();
    setCurrentIP(ip);
    setDetectingIP(false);
  };

  const addCurrentIPToAllowed = () => {
    if (currentIP && settings && !settings.allowed_ip_addresses.includes(currentIP)) {
      updateSetting('allowed_ip_addresses', [...settings.allowed_ip_addresses, currentIP]);
      toast({
        title: 'IP Added',
        description: `${currentIP} added to allowed list`,
      });
    }
  };

  const addCustomIP = () => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!newIP.trim()) return;

    if (!ipRegex.test(newIP.trim())) {
      toast({
        title: 'Invalid IP',
        description: 'Please enter a valid IPv4 address',
        variant: 'destructive',
      });
      return;
    }

    if (settings && !settings.allowed_ip_addresses.includes(newIP.trim())) {
      updateSetting('allowed_ip_addresses', [...settings.allowed_ip_addresses, newIP.trim()]);
      setNewIP('');
    }
  };

  const removeIP = (ip: string) => {
    if (settings) {
      updateSetting('allowed_ip_addresses', settings.allowed_ip_addresses.filter(i => i !== ip));
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await SettingsService.getSettings();
      setSettings(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await SettingsService.updateSettings(settings);
      toast({
        title: 'Saved',
        description: 'Company settings updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    if (settings) {
      setSettings({ ...settings, [key]: value });
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Company Settings</h1>
          <p className="text-[var(--color-subtext)]">Configure your organization's settings</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <LoadingSpinner size="sm" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* General Settings */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            General
          </CardTitle>
          <CardDescription>Basic company information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[var(--color-text)]">Company Name</Label>
              <Input
                value={settings.company_name}
                onChange={(e) => updateSetting('company_name', e.target.value)}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(value) => updateSetting('timezone', value)}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Settings */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Payroll
          </CardTitle>
          <CardDescription>Pay period and overtime configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[var(--color-text)]">Pay Period Type</Label>
              <Select
                value={settings.pay_period_type}
                onValueChange={(value: any) => updateSetting('pay_period_type', value)}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {PAY_PERIOD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Overtime Threshold (hours/week)</Label>
              <Input
                type="number"
                value={settings.overtime_threshold}
                onChange={(e) => updateSetting('overtime_threshold', parseInt(e.target.value) || 40)}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Overtime Multiplier</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.overtime_multiplier}
                onChange={(e) => updateSetting('overtime_multiplier', parseFloat(e.target.value) || 1.5)}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Auto Clock-Out After (hours)</Label>
              <Input
                type="number"
                value={settings.auto_clock_out_hours}
                onChange={(e) => updateSetting('auto_clock_out_hours', parseInt(e.target.value) || 12)}
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]"
              />
              <p className="text-xs text-[var(--color-subtext)] mt-1">Set to 0 to disable</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Tracking Settings */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Tracking
          </CardTitle>
          <CardDescription>Clock-in and break settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[var(--color-text)]">Require Scheduled Shift</Label>
              <p className="text-sm text-[var(--color-subtext)]">Employees must have a scheduled shift to clock in</p>
            </div>
            <Switch
              checked={settings.require_scheduled_shift}
              onCheckedChange={(checked) => updateSetting('require_scheduled_shift', checked)}
            />
          </div>
          {!settings.require_scheduled_shift && (
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-300">
                <strong>Free Clock-In Mode:</strong> Employees can clock in at any time without needing a pre-scheduled shift.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
            <div>
              <Label className="text-[var(--color-text)]">Break Tracking</Label>
              <p className="text-sm text-[var(--color-subtext)]">Enable break time tracking for shifts</p>
            </div>
            <Switch
              checked={settings.break_tracking_enabled}
              onCheckedChange={(checked) => updateSetting('break_tracking_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Network Restriction Settings */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Network Restriction
          </CardTitle>
          <CardDescription>Restrict clock-in to company WiFi/network</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[var(--color-text)]">Require Company Network</Label>
              <p className="text-sm text-[var(--color-subtext)]">Employees can only clock in from allowed IP addresses</p>
            </div>
            <Switch
              checked={settings.require_company_network}
              onCheckedChange={(checked) => updateSetting('require_company_network', checked)}
            />
          </div>

          {/* Current IP Detection */}
          <div className="p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[var(--color-subtext)]" />
                <span className="text-sm text-[var(--color-subtext)]">Your current public IP:</span>
                {detectingIP ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <code className="text-sm font-mono text-[var(--color-text)] bg-[var(--color-surface)] px-2 py-0.5 rounded">
                    {currentIP || 'Unable to detect'}
                  </code>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={detectCurrentIP}
                  disabled={detectingIP}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${detectingIP ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                {currentIP && !settings.allowed_ip_addresses.includes(currentIP) && (
                  <Button
                    size="sm"
                    onClick={addCurrentIPToAllowed}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add This IP
                  </Button>
                )}
              </div>
            </div>
          </div>

          {settings.require_company_network && (
            <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
              {/* Add Custom IP */}
              <div>
                <Label className="text-[var(--color-text)]">Add IP Address</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newIP}
                    onChange={(e) => setNewIP(e.target.value)}
                    placeholder="e.g., 203.0.113.50"
                    className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && addCustomIP()}
                  />
                  <Button onClick={addCustomIP} variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <p className="text-xs text-[var(--color-subtext)] mt-1">
                  Add your company's public IP address(es). Employees must connect from these IPs to clock in.
                </p>
              </div>

              {/* Allowed IPs List */}
              <div>
                <Label className="text-[var(--color-text)]">Allowed IP Addresses</Label>
                <div className="mt-2 space-y-2">
                  {settings.allowed_ip_addresses.length === 0 ? (
                    <p className="text-sm text-[var(--color-subtext)] italic py-2">
                      No IP addresses configured. Add your company's public IP to enable network restriction.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {settings.allowed_ip_addresses.map((ip) => (
                        <Badge
                          key={ip}
                          variant="secondary"
                          className="font-mono text-sm py-1.5 px-3 flex items-center gap-2"
                        >
                          {ip}
                          {ip === currentIP && (
                            <span className="text-xs text-green-600">(current)</span>
                          )}
                          <button
                            onClick={() => removeIP(ip)}
                            className="ml-1 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {settings.allowed_ip_addresses.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <strong>How it works:</strong> When employees try to clock in, the system checks their public IP address.
                    If they're connected to your company WiFi, their public IP will match one of the allowed addresses.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card className="bg-[var(--color-surface)] border-[var(--color-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-text)] flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Configuration
          </CardTitle>
          <CardDescription>Configure AI provider for conversation intelligence and auditing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[var(--color-text)]">AI Provider</Label>
              <Select
                value={settings.ai_provider || 'openai'}
                onValueChange={(value: 'openai' | 'lmstudio' | 'local') => {
                  updateSetting('ai_provider', value);
                  // Set default model for the provider
                  const defaultModel = value === 'openai' ? 'gpt-4o-mini' : 'local-model';
                  updateSetting('ai_model', defaultModel);
                  // Clear endpoint when switching away from cloud providers
                  if (value === 'lmstudio' || value === 'local') {
                    // Endpoint must be configured manually - no default localhost
                    if (!settings.ai_endpoint) {
                      updateSetting('ai_endpoint', '');
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue placeholder="Select AI provider" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {AI_PROVIDERS.map((provider) => (
                    <SelectItem key={provider.value} value={provider.value}>
                      <div className="flex flex-col">
                        <span>{provider.label}</span>
                        <span className="text-xs text-[var(--color-subtext)]">{provider.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--color-text)]">Model</Label>
              <Select
                value={settings.ai_model || 'gpt-4o-mini'}
                onValueChange={(value) => updateSetting('ai_model', value)}
              >
                <SelectTrigger className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-surface)] border-[var(--color-border)]">
                  {(AI_MODELS[(settings.ai_provider || 'openai') as keyof typeof AI_MODELS] || AI_MODELS.openai).map((model) => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(!settings.ai_provider || settings.ai_provider === 'openai') && (
            <div>
              <Label className="text-[var(--color-text)]">OpenAI API Key</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings.ai_api_key}
                    onChange={(e) => updateSetting('ai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--color-subtext)] mt-1">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI Dashboard</a>
              </p>
            </div>
          )}

          {(settings.ai_provider === 'lmstudio' || settings.ai_provider === 'local') && (
            <div>
              <Label className="text-[var(--color-text)]">LM Studio Endpoint</Label>
              <Input
                value={settings.ai_endpoint || ''}
                onChange={(e) => updateSetting('ai_endpoint', e.target.value)}
                placeholder="e.g., http://your-server:1234/v1"
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] font-mono"
              />
              <p className="text-xs text-[var(--color-subtext)] mt-1">
                Enter your LM Studio server's OpenAI-compatible API endpoint
              </p>
            </div>
          )}

          {/* Provider Info Box */}
          {(!settings.ai_provider || settings.ai_provider === 'openai') && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>OpenAI:</strong> Uses cloud-based GPT models. Requires an API key and internet connection.
                Cost is based on usage (typically $0.001-0.01 per call analysis).
              </p>
            </div>
          )}

          {(settings.ai_provider === 'lmstudio' || settings.ai_provider === 'local') && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-green-700">
                <strong>LM Studio:</strong> Runs AI locally on your hardware. No API key needed, no per-call costs.
                Requires LM Studio running with a loaded model. Recommended: Mac Mini M4 Pro with 48GB RAM.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
