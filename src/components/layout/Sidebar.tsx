import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, LayoutDashboard, Clock, Calendar, CheckSquare, DollarSign, ClipboardList, Settings, FileText, Users, Upload, Award, Phone } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { canManageUsers, canManageAllTimeEntries } = useUserRoles();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresAuth: false },
    { href: '/profile', label: 'My Profile', icon: Users, requiresAuth: false },
    { href: '/report-cards', label: 'Report Cards', icon: Award, requiresAuth: false },
    { href: '/audit-upload', label: 'AI Audit Tool', icon: Upload, requiresAuth: canManageUsers() },
    { href: '/five9-config', label: 'Five9 Integration', icon: Phone, requiresAuth: canManageUsers() },
    { href: '/shift-report', label: 'Shifts', icon: Calendar, requiresAuth: canManageAllTimeEntries() },
    { href: '/time-off-approvals', label: 'Time Off', icon: CheckSquare, requiresAuth: canManageAllTimeEntries() },
    { href: '/time-correction-approvals', label: 'Corrections', icon: ClipboardList, requiresAuth: canManageAllTimeEntries() },
    { href: '/time-off-report', label: 'Time Off Report', icon: FileText, requiresAuth: canManageUsers() },
    { href: '/uto-report', label: 'UTO Report', icon: FileText, requiresAuth: canManageUsers() },
    { href: '/admin', label: 'Admin Panel', icon: Settings, requiresAuth: canManageUsers() },
  ];

  // Filter links based on permissions
  const visibleLinks = links.filter(link => !link.requiresAuth || link.requiresAuth);

  if (!mounted) return null;

  return (
    <aside className="w-64 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col h-screen sticky top-0">
      {/* === Top Section === */}
      <div>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/cliopa.png"
            alt="Cliopa.io"
            className="w-20 h-20 object-contain mb-3"
          />
          <h2 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">
            Cliopa.io
          </h2>
          <p className="text-xs text-[var(--color-subtext)] mt-1">
            AI-Powered Workforce
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;

            return (
              <Link
                key={link.href}
                to={link.href}
                className={`
                  flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-border)]'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* === Bottom Section === */}
      <div className="mt-auto flex flex-col items-center gap-3 border-t border-[var(--color-border)] pt-4">
        {/* Light/Dark Mode Switch */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 w-full justify-center rounded-md border border-[var(--color-border)] px-3 py-2 transition hover:bg-[var(--color-border)] text-[var(--color-text)]"
        >
          {theme === 'light' ? (
            <>
              <Moon className="h-5 w-5" />
              <span className="text-sm">Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="h-5 w-5" />
              <span className="text-sm">Light Mode</span>
            </>
          )}
        </button>

        {/* Footer */}
        <p className="text-xs text-[var(--color-subtext)] text-center">
          © {new Date().getFullYear()} TLC Time
        </p>
      </div>
    </aside>
  );
};
