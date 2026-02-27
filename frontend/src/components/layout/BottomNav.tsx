"use client"

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessageSquare, Upload, Map, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

const NAV_ITEMS = [
    { key: 'nav.dashboard' as const, href: '/', icon: LayoutDashboard },
    { key: 'nav.chat' as const, href: '/chatbot', icon: MessageSquare },
    { key: 'nav.upload' as const, href: '/upload', icon: Upload, isCenter: true },
    { key: 'nav.ocean' as const, href: '/ocean-data', icon: Map },
    { key: 'nav.settings' as const, href: '/settings', icon: Settings },
];

export default function BottomNav() {
    const pathname = usePathname();
    const { t } = useLanguage();

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-area-bottom">
            <div className="flex items-end justify-around px-2 h-16 relative">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    if (item.isCenter) {
                        return (
                            <Link key={item.href} href={item.href} className="relative -mt-5 flex flex-col items-center group">
                                <div className={cn(
                                    "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90",
                                    isActive
                                        ? "bg-primary shadow-primary/30 scale-105"
                                        : "bg-primary/90 shadow-primary/20 hover:scale-105"
                                )}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                                <span className={cn(
                                    "text-[9px] font-bold mt-1 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {t(item.key)}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2 px-3 group">
                            <div className={cn(
                                "p-1.5 rounded-xl transition-all duration-200 active:scale-90",
                                isActive ? "bg-primary/10" : ""
                            )}>
                                <Icon className={cn(
                                    "w-5 h-5 transition-colors",
                                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[9px] font-bold transition-colors",
                                isActive ? "text-primary" : "text-muted-foreground"
                            )}>
                                {t(item.key)}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
