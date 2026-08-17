'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingCart,
  BookOpen,
  TrendingUp,
  BarChart3,
  Clock,
  Plug,
  Settings,
  LogOut,
  ChevronsUpDown,
  Building2,
  Bot,
  Undo2,
  Users,
  ExternalLink,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { clearAuth } from '@/lib/auth';

type NavChild = { label: string; href: string; soon?: boolean };
type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  children?: NavChild[];
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Inbox', href: '/dashboard/inbox', icon: MessageSquare, soon: true },
    ],
  },
  {
    label: 'Storefront',
    items: [
      { label: 'Catalog', href: '/dashboard/catalog', icon: Package, soon: true },
      { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart, soon: true },
      { label: 'Knowledge Base', href: '/dashboard/kb', icon: BookOpen, soon: true },
    ],
  },
  {
    label: 'Business Intelligence',
    items: [
      { label: 'Demand', href: '/dashboard/demand', icon: TrendingUp },
      { label: 'Store Health', href: '/dashboard/store', icon: BarChart3 },
      { label: 'Activity', href: '/dashboard/activity', icon: Clock },
    ],
  },
  {
    label: 'Integrations',
    items: [
      {
        label: 'Channels',
        icon: Plug,
        children: [
          { label: 'WhatsApp', href: '/dashboard/integrations/whatsapp', soon: true },
          { label: 'Instagram', href: '/dashboard/integrations/instagram', soon: true },
          { label: 'Facebook', href: '/dashboard/integrations/facebook', soon: true },
          { label: 'WooCommerce', href: '/dashboard/integrations/woocommerce' },
        ],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        label: 'Configure',
        icon: Settings,
        children: [
          { label: 'Business', href: '/dashboard/settings', soon: false },
          { label: 'Agent', href: '/dashboard/settings/agent', soon: true },
          { label: 'Cart Recovery', href: '/dashboard/settings/cart-recovery', soon: true },
          { label: 'Team', href: '/dashboard/settings/team', soon: true },
        ],
      },
    ],
  },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5 no-underline">
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-ink shrink-0"
      >
        <span className="size-3 rounded-[3px] bg-lime" />
      </span>
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-sm font-extrabold tracking-tight text-foreground" style={{ fontFamily: 'Syne, sans-serif' }}>
          PALDA
        </span>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Commerce
        </span>
      </div>
    </Link>
  );
}

function ComingBadge() {
  return (
    <span className="ml-auto rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
      Soon
    </span>
  );
}

export function AppSidebar({ email, storeName }: { email: string; storeName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const initial = email ? email[0].toUpperCase() : 'P';

  function handleLogout() {
    clearAuth();
    router.replace('/login');
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Brand />
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  if (item.children) {
                    const anyActive = item.children.some((c) => pathname === c.href);
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton isActive={anyActive} tooltip={item.label}>
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        <SidebarMenuSub>
                          {item.children.map((child) => (
                            <SidebarMenuSubItem key={child.label}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={pathname === child.href}
                              >
                                <Link href={child.href}>
                                  <span>{child.label}</span>
                                  {child.soon && <ComingBadge />}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                    );
                  }
                  const active =
                    item.href === '/dashboard'
                      ? pathname === '/dashboard'
                      : pathname.startsWith(item.href!);
                  return (
                    <SidebarMenuItem key={item.label}>
                      {item.soon ? (
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.label}
                          disabled
                        >
                          <Icon />
                          <span>{item.label}</span>
                          <ComingBadge />
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Link href={item.href!}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent"
                >
                  <Avatar className="size-8 rounded-md">
                    <AvatarFallback className="rounded-md bg-lime text-ink font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight min-w-0">
                    <span className="truncate text-xs font-medium">{email || 'Signed in'}</span>
                    <span className="truncate text-[10px] text-muted-foreground uppercase tracking-wider">
                      {storeName || 'Workspace'}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={8}
                className="w-56"
              >
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Account
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Building2 />
                    Business settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Bot />
                  Agent settings
                  <ComingBadge />
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Undo2 />
                  Cart recovery
                  <ComingBadge />
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Users />
                  Team
                  <ComingBadge />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
