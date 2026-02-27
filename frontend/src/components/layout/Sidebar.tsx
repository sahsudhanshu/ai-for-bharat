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
  { titleKey: "nav.ocean", href: "/ocean-data", icon: Map },
  { titleKey: "nav.chat", href: "/chatbot", icon: MessageSquare },
  { titleKey: "nav.analytics", href: "/analytics", icon: BarChart3 },
]

const secondaryItems: NavItem[] = [
  { titleKey: "nav.settings", href: "/settings", icon: Settings },
  { titleKey: "nav.help", href: "/help", icon: HelpCircle },
]

export default function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()
  const { t } = useLanguage()

  const NavContent = () => (
    <div className="flex flex-col h-full py-4 space-y-4">
      <div className="px-6 mb-6">
        <Logo />
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 px-4 py-6 rounded-xl transition-all",
                  pathname === item.href
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{t(item.titleKey)}</span>
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-border/50">
          <div className="px-4 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('nav.account')}
          </div>
          <div className="space-y-1">
            {secondaryItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 px-4 py-6 rounded-xl transition-all",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{t(item.titleKey)}</span>
                </Button>
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-6 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('nav.logout')}</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div className="px-6 py-4">
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-medium text-primary mb-1 text-center">{t('common.beta')}</p>
          <p className="text-[10px] text-muted-foreground text-center italic">{t('common.challenge')}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={cn("hidden lg:flex flex-col w-72 h-screen border-r border-border/50 bg-card/50 backdrop-blur-xl sticky top-0", className)}>
        <NavContent />
      </aside>

      {/* Mobile Drawer — hidden when bottom nav present on small screens */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden hidden sm:flex absolute left-4 top-4 z-50 rounded-xl hover:bg-primary/5">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="p-0 w-72">
          <NavContent />
        </SheetContent>
      </Sheet>
    </>
  )
}
