'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getAuth, saveAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import { AppSidebar } from '@/components/AppSidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

function getEmailFromToken(token: string): string {
  try {
    return JSON.parse(atob(token.split('.')[1])).email ?? '';
  } catch {
    return '';
  }
}

function pageTitleFor(pathname: string): string {
  if (pathname === '/dashboard') return 'Overview';
  if (pathname.startsWith('/dashboard/demand')) return 'Demand Intelligence';
  if (pathname.startsWith('/dashboard/store')) return 'Store Health';
  if (pathname.startsWith('/dashboard/activity')) return 'Activity';
  if (pathname.startsWith('/dashboard/inbox')) return 'Inbox';
  if (pathname.startsWith('/dashboard/catalog')) return 'Catalog';
  if (pathname.startsWith('/dashboard/orders')) return 'Orders';
  if (pathname.startsWith('/dashboard/kb')) return 'Knowledge Base';
  if (pathname.startsWith('/dashboard/integrations')) return 'Integrations';
  if (pathname.startsWith('/dashboard/settings')) return 'Settings';
  return 'Dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [storeName, setStoreName] = useState('');
  const [lastSync, setLastSync] = useState('—');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    const auth = getAuth();
    if (!auth) return;

    if (auth.storeName) setStoreName(auth.storeName);
    const sync = localStorage.getItem('palda_last_sync');
    if (sync) setLastSync(sync);
    setEmail(getEmailFromToken(auth.token));

    api.getProfile(auth.token).then((profile) => {
      setStoreName(profile.storeName);
      saveAuth(auth.token, auth.apiKey, auth.storeId, profile.storeName, profile.storeUrl);
    }).catch(() => {});
  }, [router]);

  const title = pageTitleFor(pathname);

  return (
    <SidebarProvider>
      <AppSidebar email={email} storeName={storeName} />
      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div
            className="text-sm font-bold tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            {title}
          </div>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
            {lastSync && (
              <span>
                Last sync <span className="text-foreground">{lastSync}</span>
              </span>
            )}
            {storeName && (
              <span className="rounded-sm border px-2 py-0.5 uppercase tracking-wider">
                {storeName}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
