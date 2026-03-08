"use client"

import React from 'react';
import { motion } from 'framer-motion';
import {
  CloudSun,
  Camera,
  MapPin,
  BarChart3,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { ComponentType } from '@/types/agent-first';

interface CapabilityCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  command: string;
  color: string;
  gradient: string;
  /** If set, opens this tool in the Right Pane instead of sending a text prompt */
  paneAction?: ComponentType;
}

interface CapabilityCardsProps {
  onCardClick?: (command: string) => void;
  className?: string;
}

/**
 * CapabilityCards - Interactive grid of feature cards displayed in empty state
 * 
 * Features:
 * - 2x2 grid on desktop, single column on mobile
 * - Glassmorphism styling with oceanic theme
 * - Animated entrance with staggered delays
 * - Click handlers for triggering feature commands OR opening pane tools
 * - Full i18n support
 */
export default function CapabilityCards({
  onCardClick,
  className,
}: CapabilityCardsProps) {
  const { t } = useLanguage();
  const setActiveComponent = useAgentFirstStore((s) => s.setActiveComponent);

  const cards: CapabilityCard[] = [
    {
      id: 'daily-briefing',
      title: t('capability.dailyBriefing'),
      description: t('capability.dailyBriefingDesc'),
      icon: CloudSun,
      command: 'Give me today\'s daily briefing — weather, best fishing zones, market prices, and any safety alerts.',
      color: 'text-amber-400',
      gradient: 'from-amber-500/20 to-orange-500/10',
    },
    {
      id: 'upload-catch',
      title: t('capability.uploadCatch'),
      description: t('capability.uploadCatchDesc'),
      icon: Camera,
      command: '',
      color: 'text-emerald-400',
      gradient: 'from-emerald-500/20 to-teal-500/10',
      paneAction: 'upload',
    },
    {
      id: 'view-map',
      title: t('capability.viewMap'),
      description: t('capability.viewMapDesc'),
      icon: MapPin,
      command: '',
      color: 'text-cyan-400',
      gradient: 'from-cyan-500/20 to-blue-500/10',
      paneAction: 'map',
    },
    {
      id: 'analytics',
      title: t('capability.analytics'),
      description: t('capability.analyticsDesc'),
      icon: BarChart3,
      command: '',
      color: 'text-purple-400',
      gradient: 'from-purple-500/20 to-pink-500/10',
      paneAction: 'analytics',
    },
  ];

  const handleCardClick = (card: CapabilityCard) => {
    // If the card has a pane action, open the tool in the Right Pane
    if (card.paneAction) {
      setActiveComponent(card.paneAction);
      return;
    }
    // Otherwise, send the command as a text prompt
    if (onCardClick && card.command) {
      onCardClick(card.command);
    }
  };

  return (
    <div className={cn("w-full px-4 py-6", className)}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 text-center"
      >
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t('capability.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('capability.subtitle')}
        </p>
      </motion.div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {cards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.button
              key={card.id}
              custom={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.1,
                duration: 0.3,
                ease: 'easeOut',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95, opacity: 0.8 }}
              onClick={() => handleCardClick(card)}
              className={cn(
                "group relative overflow-hidden rounded-xl p-4",
                "bg-card/30 backdrop-blur-md border border-border/20",
                "hover:border-border/40 hover:bg-card/40",
                "transition-all duration-200",
                "text-left focus:outline-none focus:ring-2 focus:ring-primary/50",
                "shadow-lg hover:shadow-xl"
              )}
            >
              {/* Gradient Background */}
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                  card.gradient
                )}
              />

              {/* Content */}
              <div className="relative z-10 flex items-start gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                    "bg-gradient-to-br border border-border/20",
                    "shadow-md group-hover:shadow-lg transition-shadow",
                    card.gradient
                  )}
                >
                  <Icon className={cn("w-5 h-5", card.color)} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1 leading-tight">
                    {card.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </div>

              {/* Hover Glow Effect */}
              <div
                className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300",
                  "bg-gradient-to-br blur-xl",
                  card.gradient
                )}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Footer Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="mt-6 text-center text-xs text-muted-foreground/60"
      >
        {t('capability.hint')}
      </motion.p>
    </div>
  );
}
