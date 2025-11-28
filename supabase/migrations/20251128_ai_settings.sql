-- Add AI provider settings to company_settings table (key-value format)

-- Insert AI settings with defaults
INSERT INTO company_settings (setting_key, setting_value, description) VALUES
    ('ai_provider', '"openai"', 'AI provider: openai, lmstudio, or local'),
    ('ai_api_key', '""', 'API key for the AI provider (encrypted at rest)'),
    ('ai_endpoint', '"http://localhost:1234/v1"', 'Custom endpoint URL for LM Studio or local AI'),
    ('ai_model', '"gpt-4o-mini"', 'Model name to use for AI analysis')
ON CONFLICT (setting_key) DO NOTHING;
