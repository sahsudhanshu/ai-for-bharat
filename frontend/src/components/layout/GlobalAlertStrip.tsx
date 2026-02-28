"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ShieldAlert, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    fetchLiveAlerts,
    computeSafetyStatus,
    getSeverityColor,
    getSeverityLabel,
    getAlertIcon,
} from "@/lib/alerts";
import type { DisasterAlert } from "@/lib/alerts";

/**
 * Global alert strip — fetches LIVE alerts from OpenWeatherMap.
 * Only shows when user's GPS location falls inside a danger zone.
 */
export default function GlobalAlertStrip() {
    const [dismissed, setDismissed] = useState(false);
    const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY || "";

    // Fetch live alerts
    useEffect(() => {
        if (!apiKey) return;
        fetchLiveAlerts(apiKey).then(setAlerts).catch(console.error);
        // Refresh every 5 minutes
        const interval = setInterval(() => {
            fetchLiveAlerts(apiKey).then(setAlerts).catch(console.error);
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [apiKey]);

    // Get user location
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => { } // silent fail
        );
    }, []);

    const safetyStatus = useMemo(() => {
        if (!userLocation) return null;
        return computeSafetyStatus(userLocation.lat, userLocation.lng, alerts);
    }, [userLocation, alerts]);

    // Only show if UNSAFE
    if (dismissed || alerts.length === 0) return null;
    if (!safetyStatus || safetyStatus === "SAFE") return null;

    const sorted = [...alerts].sort((a, b) => {
        const order: Record<string, number> = { red: 0, orange: 1, yellow: 2 };
        return order[a.severity] - order[b.severity];
    });
    const top = sorted[0];

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-4 py-2 border-b text-sm",
                top.severity === "red"
                    ? "bg-red-500/8 border-red-500/20"
                    : top.severity === "orange"
                        ? "bg-orange-500/8 border-orange-500/20"
                        : "bg-yellow-500/8 border-yellow-500/20"
            )}
        >
            <span className="text-base">{getAlertIcon(top.type)}</span>
            <span className="font-bold text-xs sm:text-sm truncate">{top.title}</span>
            <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full hidden sm:inline-block"
                style={{
                    backgroundColor: getSeverityColor(top.severity) + "20",
                    color: getSeverityColor(top.severity),
                }}
            >
                {getSeverityLabel(top.severity)}
            </span>
            <span className="text-xs text-muted-foreground truncate hidden md:inline">
                {top.description.slice(0, 80)}…
            </span>

            <div className="ml-auto flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border bg-red-500/15 border-red-500/30 text-red-400">
                    <ShieldAlert className="w-3 h-3" />
                    UNSAFE
                </span>
                <Link
                    href="/ocean-data"
                    className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
                >
                    View Map <ChevronRight className="w-3 h-3" />
                </Link>
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
