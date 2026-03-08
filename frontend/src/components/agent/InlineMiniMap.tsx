"use client";

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import 'leaflet/dist/leaflet.css';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer   = dynamic(() => import('react-leaflet').then(m => m.TileLayer),   { ssr: false });
const LeafMarker  = dynamic(() => import('react-leaflet').then(m => m.Marker),      { ssr: false });
const Popup       = dynamic(() => import('react-leaflet').then(m => m.Popup),        { ssr: false });

const MAP_TILE = "https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}";

interface InlineMiniMapProps {
  lat: number;
  lon: number;
  className?: string;
}

/**
 * A compact interactive map rendered inline inside an agent chat bubble.
 * Shows a marker at the given coordinates with an "Expand" button that
 * opens the full map canvas pane.
 */
export default function InlineMiniMap({ lat, lon, className }: InlineMiniMapProps) {
  const setActiveComponent = useAgentFirstStore(s => s.setActiveComponent);
  const center = useMemo<[number, number]>(() => [lat, lon], [lat, lon]);

  return (
    <div className={cn(
      "mt-2 rounded-xl overflow-hidden border border-border/30 shadow-sm",
      "w-full max-w-[400px]",
      className,
    )}>
      {/* Mini map */}
      <div className="h-[200px] relative">
        <MapContainer
          center={center}
          zoom={11}
          zoomControl={false}
          dragging={true}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          attributionControl={false}
          className="w-full h-full z-10"
          style={{ background: '#0a1628' }}
        >
          <TileLayer url={MAP_TILE} maxZoom={18} />
          <LeafMarker position={center}>
            <Popup>
              <div className="text-xs font-medium p-1">
                {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
              </div>
            </Popup>
          </LeafMarker>
        </MapContainer>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/80 backdrop-blur-sm border-t border-border/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 text-primary" />
          <span className="font-medium">{lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
        </div>
        <button
          onClick={() => setActiveComponent('map', { initialCenter: [lat, lon], initialZoom: 12 })}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
        >
          <Maximize2 className="w-3 h-3" />
          Expand
        </button>
      </div>
    </div>
  );
}
