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
  ChevronLeft,
  Menu,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import Logo from "./Logo"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean
}

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Upload Catch",
    href: "/upload",
    icon: Upload,
  },
  {
    title: "Ocean Data",
    href: "/ocean-data",
    icon: Map,
  },
  {
    title: "AI Assistant",
    href: "/chatbot",
    icon: MessageSquare,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
]

const secondaryItems = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Help & Support",
    href: "/help",
    icon: HelpCircle,
  },
]

export default function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname()

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
                <span className="font-medium">{item.title}</span>
              </Button>
            </Link>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-border/50">
          <div className="px-4 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Account
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
                  <span className="font-medium">{item.title}</span>
                </Button>
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-4 py-6 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div className="px-6 py-4">
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
          <p className="text-xs font-medium text-primary mb-1 text-center">Beta Version 1.0</p>
          <p className="text-[10px] text-muted-foreground text-center italic">AWS AI for Bharat Challenge</p>
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

        {/* Mobile Drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden absolute left-4 top-5 z-50 rounded-xl hover:bg-primary/5">
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
