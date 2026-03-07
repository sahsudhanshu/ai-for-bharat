"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Upload,
  Map,
  MessageSquare,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  Images,
  User,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useLanguage } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n"
import Logo from "./Logo"

interface NavItem {
  titleKey: TranslationKey;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { titleKey: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { titleKey: "nav.upload", href: "/upload", icon: Upload },
  { titleKey: "nav.groups", href: "/history", icon: Images },
  { titleKey: "nav.ocean", href: "/ocean-data", icon: Map },
  { titleKey: "nav.chat", href: "/chatbot", icon: MessageSquare },
  { titleKey: "nav.analytics", href: "/analytics", icon: BarChart3 },
]

const secondaryItems: NavItem[] = [
  { titleKey: "common.profile" as TranslationKey, href: "/profile", icon: User },
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
  { titleKey: "nav.help", href: "/help", icon: HelpCircle },
]

export default function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const NavContent = () => (
    <div className="flex flex-col h-full py-5 space-y-2">
      <div className="px-6 mb-4">
        <Logo />
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 px-4 py-5 rounded-xl transition-all duration-300 relative overflow-hidden group",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary hover:bg-primary/15 shadow-sm shadow-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                {isActive(item.href) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary rounded-r-full animate-scale-in" />
                )}
                <item.icon className={cn(
                  "w-[18px] h-[18px] transition-transform duration-300",
                  isActive(item.href) && "scale-110"
                )} />
                <span className="font-medium text-[13px]">{t(item.titleKey)}</span>
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border/30">
          <div className="px-4 mb-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
            {t('nav.account')}
          </div>
          <div className="space-y-0.5">
            {secondaryItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 px-4 py-5 rounded-xl transition-all duration-300",
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                  <span className="font-medium text-[13px]">{t(item.titleKey)}</span>
                </Button>
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300"
            >
              <LogOut className="w-[18px] h-[18px]" />
              <span className="font-medium text-[13px]">{t('nav.logout')}</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div className="px-5 py-3">
        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/8">
          <p className="text-[10px] font-semibold text-primary/80 mb-0.5 text-center tracking-wide">{t('common.beta')}</p>
          <p className="text-[9px] text-muted-foreground/60 text-center">{t('common.challenge')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden lg:flex flex-col w-[260px] h-screen border-r border-border/30 bg-card/40 backdrop-blur-xl sticky top-0 transition-all duration-300",
        className
      )}>
        <NavContent />
      </aside>

      {/* Mobile Drawer — hidden when bottom nav present on small screens */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden hidden sm:flex absolute left-4 top-4 z-50 rounded-xl hover:bg-primary/5">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="p-0 w-[260px]">
          <NavContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
