/**
 * OfflineIndicator component
 * Displays network connectivity status in agent header
 * 
 * Requirements: 12.1, 12.2, 12.8
 */

'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';

export interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className = '' }: OfflineIndicatorProps) {
  const isOffline = useAgentFirstStore((state) => state.isOffline);
  const [showReconnected, setShowReconnected] = useState(false);

  // Handle reconnection message
  useEffect(() => {
    if (!isOffline && showReconnected) {
      // Fade out after 3 seconds
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOffline, showReconnected]);

  // Track when we go from offline to online
  useEffect(() => {
    if (!isOffline) {
      setShowReconnected(true);
    }
  }, [isOffline]);

  return (
    <AnimatePresence mode="wait">
      {isOffline && (
        <motion.div
          key="offline"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 ${className}`}
          role="status"
          aria-live="polite"
        >
          <WifiOff className="w-4 h-4 text-amber-500" aria-hidden="true" />
          <span className="text-sm text-amber-500 font-medium">
            Offline
          </span>
        </motion.div>
      )}

      {!isOffline && showReconnected && (
        <motion.div
          key="reconnected"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 ${className}`}
          role="status"
          aria-live="polite"
        >
          <Wifi className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          <span className="text-sm text-emerald-500 font-medium">
            Back online
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
