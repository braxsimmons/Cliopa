import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-[var(--color-accent)] border-t-transparent',
        sizeClasses[size],
        className
      )}
    />
  );
};

interface FullPageLoaderProps {
  message?: string;
}

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg)]">
      <img
        src="/cliopa.png"
        alt="Cliopa.io"
        className="w-16 h-16 object-contain mb-4 animate-pulse"
      />
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-[var(--color-subtext)]">{message}</p>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse bg-[var(--color-border)] rounded',
        className
      )}
    />
  );
};

interface CardSkeletonProps {
  lines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ lines = 3 }) => {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      <div className="border-b border-[var(--color-border)] p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="border-b border-[var(--color-border)] p-4 last:border-0"
        >
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} className="h-4 flex-1" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
