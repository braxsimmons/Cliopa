import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-[var(--color-bg)] flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-[var(--color-subtext)]" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--color-subtext)] max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          className="border-[var(--color-border)] text-[var(--color-text)]"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An error occurred while loading. Please try again.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-subtext)] max-w-sm mb-4">
        {message}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-[var(--color-border)] text-[var(--color-text)]"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
