import React from 'react';
import { Sidebar } from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-[var(--color-bg)]">
        {/* Add top padding on mobile to account for fixed header */}
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl pt-20 lg:pt-6">
          {children}
        </div>
      </main>
    </div>
  );
};
