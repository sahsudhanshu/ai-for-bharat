"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface Props {
    /** Callback with user coords once acquired */
    onLocationFound?: (lat: number, lng: number) => void;
    /** Show 50km radius circle */
    showRadius?: boolean;
    /** Auto-center map on user location */
    autoCenter?: boolean;
}

export default function UserLocationMarker({
    onLocationFound,
    showRadius = true,
    autoCenter = true,
}: Props) {
    const map = useMap();
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCoords({ lat, lng });
                onLocationFound?.(lat, lng);
                if (autoCenter) {
                    map.flyTo([lat, lng], 9, { duration: 1.5 });
                }
            },
            () => {
                // Permission denied or error — silent fail
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [map, onLocationFound, autoCenter]);

    useEffect(() => {
        if (!coords) return;

        // ── Pulsing "You Are Here" marker ──────────────────────────────────────
        const pulseIcon = L.divIcon({
            className: "",
            html: `
        <div style="position:relative;width:40px;height:40px;">
          <div style="
            position:absolute;top:50%;left:50%;
            width:16px;height:16px;
            transform:translate(-50%,-50%);
            background:rgba(59,130,246,1);
            border:3px solid white;
            border-radius:50%;
            box-shadow:0 0 8px rgba(59,130,246,0.6);
            z-index:2;
          "></div>
          <div style="
            position:absolute;top:50%;left:50%;
            width:40px;height:40px;
            transform:translate(-50%,-50%);
            background:rgba(59,130,246,0.25);
            border-radius:50%;
            animation:locPulse 2s ease-out infinite;
            z-index:1;
          "></div>
        </div>
        <style>
          @keyframes locPulse {
            0%   { transform:translate(-50%,-50%) scale(0.5); opacity:1; }
            100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }
          }
        </style>
      `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
        });

        const marker = L.marker([coords.lat, coords.lng], { icon: pulseIcon, zIndexOffset: 1000 })
            .addTo(map)
            .bindTooltip("You Are Here", {
                permanent: false,
                direction: "top",
                offset: [0, -24],
                className: "leaflet-tooltip-location",
            });

        // ── 50km radius circle ────────────────────────────────────────────────
        let radiusCircle: L.Circle | null = null;
        if (showRadius) {
            radiusCircle = L.circle([coords.lat, coords.lng], {
                radius: 50000, // 50 km in meters
                color: "rgba(59,130,246,0.5)",
                fillColor: "rgba(59,130,246,0.06)",
                fillOpacity: 1,
                weight: 2,
                dashArray: "8 6",
            }).addTo(map);
        }

        return () => {
            map.removeLayer(marker);
            if (radiusCircle) map.removeLayer(radiusCircle);
        };
    }, [coords, map, showRadius]);

    // Inject tooltip styling
    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
      .leaflet-tooltip-location {
        background: rgba(0,0,0,0.75) !important;
        color: white !important;
        border: 1px solid rgba(59,130,246,0.4) !important;
        border-radius: 8px !important;
        padding: 4px 10px !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.02em;
        backdrop-filter: blur(8px);
      }
      .leaflet-tooltip-location::before {
        border-top-color: rgba(0,0,0,0.75) !important;
      }
    `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    return null;
}
