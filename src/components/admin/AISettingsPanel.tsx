import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Cpu,
  Server,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Zap,
  Settings2,
  TestTube,
  HardDrive,
  Loader2,
} from 'lucide-react';
import {
  checkProviderAvailability,
  getDefaultAIProvider,
  getOllamaProvider,
  getNvidiaServerProvider,
  getGeminiProvider,
  listOllamaModels,
  listGeminiModels,
  pullOllamaModel,
  testGeminiConnection,
  RECOMMENDED_MODELS,
  AIProvider,
} from '@/services/AIAuditService';
import { supabase } from '@/integrations/supabase/client';

interface AISettings {
  provider: 'lmstudio' | 'ollama' | 'openai' | 'anthropic' | 'gemini';
  host: string;
  model: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  autoProcess: boolean;
  batchSize: number;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'gemini',
  host: 'https://generativelanguage.googleapis.com',
  model: 'gemini-2.0-flash',
  apiKey: '',
  temperature: 0.3,
  maxTokens: 4000,
  autoProcess: false,
  batchSize: 10,
};

export const AISettingsPanel: React.FC = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    checkConnection();
    if (settings.provider === 'ollama') {
      fetchOllamaModels();
    } else if (settings.provider === 'gemini' && settings.apiKey) {
      fetchGeminiModels();
    }
  }, [settings.provider, settings.host, settings.apiKey]);

  const loadSettings = async () => {
    try {
      // Load AI settings from the key-value company_settings table
      const { data } = await supabase
        .from('company_settings')
        .select('setting_key, setting_value')
        .eq('setting_key', 'ai_settings')
        .single();

      if (data?.setting_value) {
        const savedSettings = typeof data.setting_value === 'string'
          ? JSON.parse(data.setting_value)
          : data.setting_value;
        setSettings({ ...DEFAULT_SETTINGS, ...savedSettings });
      }
    } catch (error) {
      // If no ai_settings row exists yet, that's okay - use defaults
      console.log('No AI settings found, using defaults');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Use upsert with the setting_key as the conflict target
      const { error } = await supabase
        .from('company_settings')
        .upsert(
          {
            setting_key: 'ai_settings',
            setting_value: settings,
            description: 'AI provider configuration for call auditing',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;

      toast({
        title: 'Settings saved',
        description: 'AI configuration has been updated.',
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Check console for details.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const provider = getProviderFromSettings();
      const isAvailable = await checkProviderAvailability(provider);
      setConnectionStatus(isAvailable ? 'connected' : 'disconnected');
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const fetchOllamaModels = async () => {
    if (settings.provider !== 'ollama') return;
    setLoadingModels(true);
    try {
      const models = await listOllamaModels(settings.host);
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const fetchGeminiModels = async () => {
    if (settings.provider !== 'gemini' || !settings.apiKey) return;
    setLoadingModels(true);
    try {
      const models = await listGeminiModels(settings.apiKey);
      setAvailableModels(models);
    } catch {
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const handlePullModel = async (model: string) => {
    setPullingModel(model);
    try {
      const success = await pullOllamaModel(model, settings.host);
      if (success) {
        toast({
          title: 'Model downloaded',
          description: `${model} is now available.`,
        });
        fetchOllamaModels();
      } else {
        throw new Error('Failed to pull model');
      }
    } catch (error) {
      toast({
        title: 'Download failed',
        description: `Could not download ${model}.`,
        variant: 'destructive',
      });
    } finally {
      setPullingModel(null);
    }
  };

  const getProviderFromSettings = (): AIProvider => {
    switch (settings.provider) {
      case 'gemini':
        return getGeminiProvider(settings.apiKey || '', settings.model);
      case 'ollama':
        return getOllamaProvider(settings.host, settings.model);
      case 'lmstudio':
        return getDefaultAIProvider();
      default:
        return getDefaultAIProvider();
    }
  };

  const runTestAudit = async () => {
    setTesting(true);
    setTestResult(null);

    const testTranscript = `
Agent: Thank you for calling, this is Sarah. How can I help you today?
Customer: Hi, I'm calling about my account balance.
Agent: Of course! I'd be happy to help you with that. May I have your account number or the phone number associated with your account?
Customer: Sure, it's 555-1234.
Agent: Thank you. Let me pull that up for you... I can see your current balance is $245.50. Is there anything else you'd like to know about your account?
Customer: No, that's all I needed. Thanks!
Agent: You're welcome! Thank you for calling and have a great day!
    `.trim();

    try {
      const provider = getProviderFromSettings();
      let response: Response;
      let content = '';

      if (settings.provider === 'gemini') {
        // Gemini uses different API format with key as query param
        // Use model name without -latest suffix (e.g., gemini-2.0-flash, gemini-2.5-flash)
        let modelName = settings.model || 'gemini-2.0-flash';
        // Strip -latest suffix if present as it's no longer used
        modelName = modelName.replace('-latest', '');
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${settings.apiKey}`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a call quality auditor. Rate this call 1-100 and provide one strength.\n\nTranscript:\n${testTranscript}\n\nRespond with JSON: {"score": number, "strength": "string"}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: settings.temperature,
              maxOutputTokens: 500,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
      } else {
        // OpenAI-compatible format for Ollama, LM Studio, etc.
        response = await fetch(provider.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [
              { role: 'system', content: 'You are a call quality auditor. Respond with a brief JSON assessment.' },
              { role: 'user', content: `Rate this call 1-100 and provide one strength. Transcript:\n${testTranscript}\n\nRespond with JSON: {"score": number, "strength": "string"}` },
            ],
            temperature: settings.temperature,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        content = data.choices?.[0]?.message?.content || '';
      }

      setTestResult({
        success: true,
        message: `AI responded successfully!\n\nResponse: ${content.substring(0, 500)}`,
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Test failed: ${error.message}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">AI Provider Status</CardTitle>
              <CardDescription>Connection to your AI service</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {connectionStatus === 'checking' && (
                <Badge variant="outline" className="gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Checking...
                </Badge>
              )}
              {connectionStatus === 'connected' && (
                <Badge className="gap-1 bg-green-500">
                  <Wifi className="h-3 w-3" />
                  Connected
                </Badge>
              )}
              {connectionStatus === 'disconnected' && (
                <Badge variant="destructive" className="gap-1">
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={checkConnection}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="provider">
        <TabsList>
          <TabsTrigger value="provider" className="gap-2">
            <Server className="h-4 w-4" />
            Provider
          </TabsTrigger>
          <TabsTrigger value="models" className="gap-2">
            <Cpu className="h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <TestTube className="h-4 w-4" />
            Test
          </TabsTrigger>
        </TabsList>

        {/* Provider Tab */}
        <TabsContent value="provider" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>
                Choose where to run your AI audits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={settings.provider}
                  onValueChange={(value: AISettings['provider']) =>
                    setSettings((s) => ({
                      ...s,
                      provider: value,
                      host:
                        value === 'ollama'
                          ? 'http://localhost:11434'
                          : value === 'lmstudio'
                          ? 'http://localhost:1234'
                          : value === 'gemini'
                          ? 'https://generativelanguage.googleapis.com'
                          : s.host,
                      model:
                        value === 'gemini'
                          ? 'gemini-2.0-flash'
                          : value === 'ollama'
                          ? 'llama3.1:8b'
                          : 'local-model',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Google AI Studio / Gemini (Recommended)
                      </div>
                    </SelectItem>
                    <SelectItem value="ollama">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Ollama (Self-Hosted)
                      </div>
                    </SelectItem>
                    <SelectItem value="lmstudio">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4" />
                        LM Studio (Local)
                      </div>
                    </SelectItem>
                    <SelectItem value="openai" disabled>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        OpenAI (Coming Soon)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.provider === 'gemini' ? (
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={settings.apiKey || ''}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, apiKey: e.target.value }))
                    }
                    placeholder="AIza..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Get your API key from{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Host URL</Label>
                  <Input
                    value={settings.host}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, host: e.target.value }))
                    }
                    placeholder="http://localhost:11434"
                  />
                  <p className="text-xs text-muted-foreground">
                    {settings.provider === 'ollama' && 'Default Ollama port: 11434'}
                    {settings.provider === 'lmstudio' && 'Default LM Studio port: 1234'}
                  </p>
                </div>
              )}

              {/* Quick setup for different environments */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium">Quick Setup</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button
                    variant={settings.provider === 'gemini' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        provider: 'gemini',
                        host: 'https://generativelanguage.googleapis.com',
                        model: 'gemini-2.0-flash',
                      }))
                    }
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Gemini (Cloud)
                  </Button>
                  <Button
                    variant={settings.provider === 'ollama' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        provider: 'ollama',
                        host: 'http://localhost:11434',
                        model: 'llama3.1:8b',
                      }))
                    }
                  >
                    <Server className="h-4 w-4 mr-2" />
                    Ollama
                  </Button>
                  <Button
                    variant={settings.provider === 'lmstudio' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        provider: 'lmstudio',
                        host: 'http://localhost:1234',
                        model: 'local-model',
                      }))
                    }
                  >
                    <HardDrive className="h-4 w-4 mr-2" />
                    LM Studio
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Selection</CardTitle>
              <CardDescription>
                {settings.provider === 'gemini'
                  ? 'Select a Gemini model for auditing'
                  : settings.provider === 'ollama'
                  ? 'Select or download Ollama models'
                  : 'Configure your AI model'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.provider === 'gemini' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Gemini Model</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchGeminiModels}
                        disabled={loadingModels || !settings.apiKey}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${loadingModels ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    </div>
                    <Select
                      value={settings.model}
                      onValueChange={(value) =>
                        setSettings((s) => ({ ...s, model: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</SelectItem>
                            <SelectItem value="gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                            <SelectItem value="gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recommended Gemini models */}
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium">Recommended Gemini Models</Label>
                    <div className="space-y-2 mt-3">
                      {RECOMMENDED_MODELS.gemini.map((rec) => (
                        <div
                          key={rec.model}
                          className="flex items-center justify-between p-2 rounded border"
                        >
                          <div>
                            <p className="text-sm font-medium">{rec.model}</p>
                            <p className="text-xs text-muted-foreground">
                              {rec.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={settings.model === rec.model ? 'default' : 'outline'}
                            onClick={() =>
                              setSettings((s) => ({ ...s, model: rec.model }))
                            }
                          >
                            {settings.model === rec.model ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Selected
                              </>
                            ) : (
                              'Select'
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : settings.provider === 'ollama' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Installed Models</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchOllamaModels}
                        disabled={loadingModels}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${loadingModels ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    </div>
                    <Select
                      value={settings.model}
                      onValueChange={(value) =>
                        setSettings((s) => ({ ...s, model: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                        {availableModels.length === 0 && (
                          <SelectItem value="" disabled>
                            No models found - pull one below
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recommended models */}
                  <div className="pt-4 border-t">
                    <Label className="text-sm font-medium">Recommended Models</Label>
                    <div className="space-y-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          For Development / Laptop
                        </p>
                        <div className="space-y-2">
                          {RECOMMENDED_MODELS.development.map((rec) => (
                            <div
                              key={rec.model}
                              className="flex items-center justify-between p-2 rounded border"
                            >
                              <div>
                                <p className="text-sm font-medium">{rec.model}</p>
                                <p className="text-xs text-muted-foreground">
                                  {rec.description} • {rec.vram} VRAM
                                </p>
                              </div>
                              {availableModels.includes(rec.model) ? (
                                <Badge variant="outline" className="text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Installed
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePullModel(rec.model)}
                                  disabled={pullingModel === rec.model}
                                >
                                  {pullingModel === rec.model ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-1" />
                                      Pull
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-2">
                          For Production / NVIDIA Server
                        </p>
                        <div className="space-y-2">
                          {RECOMMENDED_MODELS.production.map((rec) => (
                            <div
                              key={rec.model}
                              className="flex items-center justify-between p-2 rounded border"
                            >
                              <div>
                                <p className="text-sm font-medium">{rec.model}</p>
                                <p className="text-xs text-muted-foreground">
                                  {rec.description} • {rec.vram} VRAM
                                </p>
                              </div>
                              {availableModels.includes(rec.model) ? (
                                <Badge variant="outline" className="text-green-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Installed
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePullModel(rec.model)}
                                  disabled={pullingModel === rec.model}
                                >
                                  {pullingModel === rec.model ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-4 w-4 mr-1" />
                                      Pull
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Model Name</Label>
                  <Input
                    value={settings.model}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, model: e.target.value }))
                    }
                    placeholder="local-model"
                  />
                  <p className="text-xs text-muted-foreground">
                    The model identifier used by your provider
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Parameters</CardTitle>
              <CardDescription>Fine-tune AI behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Temperature: {settings.temperature}</Label>
                </div>
                <Slider
                  value={[settings.temperature]}
                  min={0}
                  max={1}
                  step={0.1}
                  onValueChange={([value]) =>
                    setSettings((s) => ({ ...s, temperature: value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Lower = more consistent, Higher = more creative
                </p>
              </div>

              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  value={settings.maxTokens}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      maxTokens: parseInt(e.target.value) || 4000,
                    }))
                  }
                />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Process New Calls</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically audit calls as they arrive
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoProcess}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({ ...s, autoProcess: checked }))
                    }
                  />
                </div>
              </div>

              {settings.autoProcess && (
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={settings.batchSize}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        batchSize: parseInt(e.target.value) || 10,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of calls to process in parallel
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Tab */}
        <TabsContent value="test" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Test AI Connection</CardTitle>
              <CardDescription>
                Run a test audit to verify your AI is working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Test Scenario</p>
                <p className="text-xs text-muted-foreground">
                  A simple customer service call will be sent to your AI provider.
                  The AI will attempt to score it and return a brief assessment.
                </p>
              </div>

              <Button
                onClick={runTestAudit}
                disabled={testing || connectionStatus !== 'connected'}
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4 mr-2" />
                    Run Test Audit
                  </>
                )}
              </Button>

              {testResult && (
                <div
                  className={`p-4 rounded-lg ${
                    testResult.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span
                      className={`font-medium ${
                        testResult.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {testResult.success ? 'Test Passed' : 'Test Failed'}
                    </span>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-40">
                    {testResult.message}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
};
