'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search,
  Bell,
  HelpCircle,
  Settings,
  ChevronDown,
  Sparkles,
  Store,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getStoredAccountId,
  getStoredAccountName,
  setStoredAccount,
  resolveActiveAccount,
  ACTIVE_ACCOUNT_CHANGED_EVENT,
  Account,
} from '@/lib/account';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export function TopNavbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const { isBlueTheme } = useTheme();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeAccount, setActiveAccount] = useState<{ id: string; name: string }>({
    id: '',
    name: 'Rehanza',
  });
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  // Load account
  useEffect(() => {
    const loadAccount = async () => {
      const storedId = getStoredAccountId();
      const storedName = getStoredAccountName();
      if (storedId && storedName) {
        setActiveAccount({ id: storedId, name: storedName });
      } else {
        const resolved = await resolveActiveAccount();
        if (resolved) {
          setActiveAccount({ id: resolved.id, name: resolved.name });
        }
      }

      try {
        const res = await fetch('/api/accounts');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setAvailableAccounts(json.data);
          }
        }
      } catch {
        // ignore
      }
    };

    loadAccount();

    const handleAccountChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name?: string }>;
      if (customEvent.detail) {
        setActiveAccount({
          id: customEvent.detail.id,
          name: customEvent.detail.name || 'Account',
        });
      }
    };

    window.addEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
    return () => window.removeEventListener(ACTIVE_ACCOUNT_CHANGED_EVENT, handleAccountChange);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Route intelligently based on query
    if (q.toLowerCase().startsWith('ord-') || !isNaN(Number(q))) {
      router.push(`/marketplace?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/products?search=${encodeURIComponent(q)}`);
    }
  };

  const userName = session?.user?.name || 'Arsad';
  const firstLetter = userName.charAt(0).toUpperCase();

  // Only render top navbar on desktop for Blue Theme to match reference design exactly
  if (!isBlueTheme) {
    return null;
  }

  return (
    <header className="hidden md:flex items-center justify-between h-16 px-6 sm:px-8 border-b border-slate-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-30 transition-all">
      {/* 1. Left: Rehanza Brand Title */}
      <div className="flex items-center gap-3 min-w-[200px]">
        <div className="h-8 w-8 rounded-lg bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 shrink-0 shadow-sm">
          <Sparkles className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-base font-black text-slate-900 tracking-tight font-headline">
              Rehanza-Hub
            </span>
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-blue-600/90">
            E-COMMERCE OS
          </span>
        </div>
      </div>

      {/* 2. Middle: Search Bar (Google Drive inspired) */}
      <div className="flex-1 max-w-xl mx-6">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders, products, payments..."
            className="w-full h-10 pl-10 pr-4 rounded-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 border border-transparent focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </form>
      </div>

      {/* 3. Right: Quick Actions & Account/Profile Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Notifications */}
        <button
          type="button"
          onClick={() => router.push('/tasks')}
          title="Notifications & Tasks"
          className="relative h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        {/* Help */}
        <button
          type="button"
          onClick={() => router.push('/settings')}
          title="Help & Support"
          className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Settings Shortcut */}
        <button
          type="button"
          onClick={() => router.push('/settings')}
          title="Settings"
          className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Account Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-800 flex items-center gap-2 font-semibold text-xs"
            >
              <div className="flex flex-col text-left leading-tight">
                <span className="font-bold text-slate-900 text-xs">
                  {activeAccount.name}
                </span>
                <span className="text-[9px] text-slate-500 font-medium">Primary Account</span>
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 text-slate-800 shadow-xl rounded-xl p-1">
            <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 py-1.5">
              Switch Account
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            {availableAccounts.length > 0 ? (
              availableAccounts.map((acc) => {
                const isSelected = acc.id === activeAccount.id;
                return (
                  <DropdownMenuItem
                    key={acc.id}
                    onClick={() => {
                      setStoredAccount(acc);
                      setActiveAccount(acc);
                    }}
                    className={cn(
                      'flex items-center justify-between text-xs px-2.5 py-2 rounded-lg cursor-pointer',
                      isSelected ? 'bg-blue-50 font-bold text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-slate-400" />
                      <span>{acc.name}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </DropdownMenuItem>
                );
              })
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  const def = { id: '1323beea-04db-4d44-a1ca-3ab7a1556f09', name: 'Rehanza' };
                  setStoredAccount(def);
                  setActiveAccount(def);
                }}
                className="text-xs px-2.5 py-2 rounded-lg bg-blue-50 font-bold text-blue-700"
              >
                <span>Rehanza (Primary)</span>
                <Check className="h-3.5 w-3.5 text-blue-600 ml-auto" />
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Avatar */}
        <Link href="/profile" title="View Profile">
          <Avatar className="h-8 w-8 rounded-full ring-2 ring-blue-500/20 hover:ring-blue-500/50 transition-all cursor-pointer">
            <AvatarFallback className="bg-blue-600 text-white font-black text-xs">
              {firstLetter}
            </AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}

