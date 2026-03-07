"use client"

import React from 'react';
import { Bell, Search, ChevronRight, LogOut, User, Settings, Globe } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from "@/lib/auth-context";
import { useLanguage, LANGUAGES } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Link from 'next/link';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { locale, setLocale, t } = useLanguage();

  const pathSegment = pathname.split('/').filter(Boolean)[0] ?? '';

  const PAGE_NAMES: Record<string, string> = {
    '': t('nav.dashboard'),
    'upload': t('nav.upload'),
    'history': t('nav.groups'),
    'ocean-data': t('nav.ocean'),
    'chatbot': t('nav.chat'),
    'analytics': t('nav.analytics'),
    'settings': t('nav.settings'),
  };

  const pageName = PAGE_NAMES[pathSegment] ?? pathSegment;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'RM';

  return (
    <header className="h-14 sm:h-16 border-b border-border/20 bg-background/60 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="lg:hidden w-12 shrink-0" /> {/* Space for mobile hamburger */}
        <div className="hidden lg:flex items-center gap-1.5 text-sm">
          <Link href="/" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors duration-300 font-medium">{t('nav.dashboard')}</Link>
          {pathSegment && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
              <span className="text-foreground font-semibold">{pageName}</span>
            </>
          )}
        </div>
        {/* Mobile: show page name */}
        <span className="lg:hidden font-bold text-sm pl-2">{pageName}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex relative w-52 xl:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            placeholder={t('header.search')}
            className="pl-9 h-9 bg-muted/30 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/20 text-sm placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="flex items-center gap-1">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-muted/30 h-9 w-9">
                <Globe className="w-4 h-4 text-muted-foreground/70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/30">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {t('header.language')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/20" />
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLocale(lang.code)}
                  className={cn(
                    "cursor-pointer flex items-center justify-between transition-colors duration-200",
                    locale === lang.code && "bg-primary/8 text-primary font-bold"
                  )}
                >
                  <span>{lang.label}</span>
                  <span className="text-[10px] text-muted-foreground/50">{lang.labelEn}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-muted/30 h-9 w-9">
            <Bell className="w-4 h-4 text-muted-foreground/70" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary/80 rounded-full" />
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="pl-1 pr-2 sm:pr-3 py-1 h-9 sm:h-10 rounded-xl gap-2 hover:bg-muted/30">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-border/30">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="font-semibold text-[12px] text-foreground leading-tight">{user?.name ?? 'Fisher'}</span>
                  <span className="text-[10px] text-muted-foreground/60 font-normal leading-tight">{user?.role ?? 'Demo User'}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-border/30">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 pb-1">
                  <p className="text-sm font-bold">{user?.name ?? 'Demo User'}</p>
                  <p className="text-[11px] text-muted-foreground/60">{user?.email ?? 'demo@oceanai.in'}</p>
                  {user?.port && <Badge className="w-fit mt-1 text-[10px] bg-primary/10 text-primary border-none">{user.port}</Badge>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 w-4 h-4" />{t('common.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 w-4 h-4" />{t('common.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-400/80 focus:text-red-400 focus:bg-red-500/5 cursor-pointer"
              >
                <LogOut className="mr-2 w-4 h-4" />
                {t('common.logOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
