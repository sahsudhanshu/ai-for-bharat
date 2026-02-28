"use client"

import React, { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import GlobalAlertStrip from './GlobalAlertStrip';
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

const PUBLIC_ROUTES = ['/login', '/signup'];

export default function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

  // Show public routes without layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Global loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading OceanAI...</p>
        </div>
      </div>
    );
  }

  // Redirect in progress — show nothing to prevent flash
  if (!isAuthenticated && !isPublicRoute) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <Header />
        <GlobalAlertStrip />
        <main className="flex-1 p-4 sm:p-6 lg:p-12 pb-24 lg:pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

