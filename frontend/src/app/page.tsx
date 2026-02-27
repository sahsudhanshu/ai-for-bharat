"use client"

import React from 'react';
import Link from 'next/link';
import {
  Upload,
  Map,
  MessageSquare,
  BarChart3,
  ChevronRight,
  TrendingUp,
  Anchor,
  Droplets,
  Fish
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

export default function Home() {
  const { t } = useLanguage();

  const features = [
    {
      title: t("dash.feature.upload"),
      description: t("dash.feature.uploadDesc"),
      icon: Upload,
      href: "/upload",
      color: "bg-blue-500",
      stats: "98% Accuracy"
    },
    {
      title: t("dash.feature.ocean"),
      description: t("dash.feature.oceanDesc"),
      icon: Map,
      href: "/ocean-data",
      color: "bg-emerald-500",
      stats: "Live Data"
    },
    {
      title: t("dash.feature.chat"),
      description: t("dash.feature.chatDesc"),
      icon: MessageSquare,
      href: "/chatbot",
      color: "bg-amber-500",
      stats: "24/7 Support"
    },
    {
      title: t("dash.feature.analytics"),
      description: t("dash.feature.analyticsDesc"),
      icon: BarChart3,
      href: "/analytics",
      color: "bg-purple-500",
      stats: "+15% Yield"
    },
  ];

  return (
    <div className="space-y-12 pb-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-ocean-gradient p-8 md:p-16 text-white shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-6">
          <Badge className="bg-white/20 text-white border-none backdrop-blur-md px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
            {t('dash.badge')}
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold leading-tight">
            {t('dash.title')} <span className="text-primary-foreground underline decoration-accent decoration-4 underline-offset-8">{t('dash.titleHighlight')}</span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-blue-100/80 font-medium max-w-lg">
            {t('dash.subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <Link href="/upload">
              <Button size="lg" className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl bg-white text-primary hover:bg-blue-50 font-bold text-sm sm:text-base shadow-lg shadow-white/10 group">
                {t('dash.analyzeCatch')}
                <ChevronRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/ocean-data">
              <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md font-bold text-sm sm:text-base">
                {t('dash.viewMap')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full scale-150">
            <circle cx="200" cy="200" r="150" stroke="white" strokeWidth="2" strokeDasharray="10 10" />
            <circle cx="200" cy="200" r="100" stroke="white" strokeWidth="2" />
            <path d="M200 50V350M50 200H350" stroke="white" strokeWidth="1" />
          </svg>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: t('dash.stat.totalCatch'), value: "1,284 kg", icon: Fish, color: "text-blue-500" },
          { label: t('dash.stat.avgPrice'), value: "₹420/kg", icon: TrendingUp, color: "text-emerald-500" },
          { label: t('dash.stat.zones'), value: "12", icon: Anchor, color: "text-amber-500" },
          { label: t('dash.stat.sustainability'), value: "88/100", icon: Droplets, color: "text-cyan-500" },
        ].map((stat, i) => (
          <Card key={i} className="rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
              <div className={stat.color + " bg-current/10 p-2.5 sm:p-3 rounded-xl"}>
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] sm:text-sm font-medium text-muted-foreground truncate">{stat.label}</p>
                <p className="text-lg sm:text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Features Grid */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">{t('dash.features')}</h2>
            <p className="text-muted-foreground max-w-md text-sm sm:text-base">{t('dash.featuresDesc')}</p>
          </div>
          <Button variant="link" className="text-primary p-0 h-auto font-bold text-sm sm:text-base">
            {t('dash.viewAll')} <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {features.map((feature, i) => (
            <Link key={i} href={feature.href} className="group">
              <Card className="h-full rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 group-hover:border-primary/20">
                <CardHeader className="p-6 sm:p-8 pb-0">
                  <div className={`${feature.color} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white mb-4 sm:mb-6 shadow-lg shadow-current/20 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                    <feature.icon className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-xl sm:text-2xl font-bold group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] sm:text-xs shrink-0">{feature.stats}</Badge>
                  </div>
                  <CardDescription className="text-sm sm:text-base pt-3 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 sm:p-8 pt-4 sm:pt-6">
                  <div className="flex items-center text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-[-10px] group-hover:translate-x-0">
                    {t('dash.getStarted')} <ChevronRight className="ml-1 w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
