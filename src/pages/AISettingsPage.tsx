import React from 'react';
import { AISettingsPanel } from '@/components/admin/AISettingsPanel';

const AISettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">AI Audit Settings</h1>
        <p className="text-[var(--color-subtext)] mt-1">
          Configure your AI provider and model for call auditing
        </p>
      </div>
      <AISettingsPanel />
    </div>
  );
};

export default AISettingsPage;
