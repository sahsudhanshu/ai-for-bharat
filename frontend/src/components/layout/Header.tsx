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
    <header className="h-16 sm:h-20 border-b border-border/50 bg-background/50 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="lg:hidden w-12 shrink-0" /> {/* Space for mobile hamburger */}
        <div className="hidden lg:flex items-center gap-2 text-sm font-medium">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.dashboard')}</Link>
          {pathSegment && (
            <>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground font-semibold">{pageName}</span>
            </>
          )}
        </div>
        {/* Mobile: show page name */}
        <span className="lg:hidden font-bold text-base pl-2">{pageName}</span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden md:flex relative w-56 xl:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('header.search')}
            className="pl-10 h-10 bg-muted/50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Language Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/5 h-10 w-10">
                <Globe className="w-5 h-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl">
              <DropdownMenuLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('header.language')}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {LANGUAGES.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  onClick={() => setLocale(lang.code)}
                  className={cn(
                    "cursor-pointer flex items-center justify-between",
                    locale === lang.code && "bg-primary/10 text-primary font-bold"
                  )}
                >
                  <span>{lang.label}</span>
                  <span className="text-[10px] text-muted-foreground">{lang.labelEn}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification bell */}
          <Button variant="ghost" size="icon" className="relative rounded-xl hover:bg-primary/5 h-10 w-10">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full border-2 border-background animate-pulse" />
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="pl-1 pr-2 sm:pr-3 py-1 h-10 sm:h-12 rounded-xl gap-2 sm:gap-3 hover:bg-primary/5">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-border/50">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start text-xs">
                  <span className="font-semibold text-foreground">{user?.name ?? 'Fisher'}</span>
                  <span className="text-muted-foreground font-normal">{user?.role ?? 'Demo User'}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1 pb-1">
                  <p className="text-sm font-bold">{user?.name ?? 'Demo User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? 'demo@oceanai.in'}</p>
                  {user?.port && <Badge className="w-fit mt-1 text-[10px] bg-primary/10 text-primary border-none">{user.port}</Badge>}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <User className="mr-2 w-4 h-4" />{t('common.profile')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 w-4 h-4" />{t('common.settings')}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer"
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
