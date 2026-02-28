/**
 * MapEventsWrapper — client component that wraps the useMapEvents hook.
 *
 * useMapEvents is a React hook and CANNOT be dynamically imported via next/dynamic.
 * This component is loaded client-side by the parent page via:
 *   const MapEventsWrapper = dynamic(() => import('@/components/map/MapEventsWrapper'), { ssr: false })
 */
"use client"

import { useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';

interface MapBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface Props {
    onMouseMove: (pos: { lat: number; lng: number }) => void;
    onClick?: (pos: { lat: number; lng: number }) => void;
    onMapReady?: (map: L.Map) => void;
    onMoveEnd?: (bounds: MapBounds, center: { lat: number; lng: number }) => void;
}

export default function MapEventsWrapper({ onMouseMove, onClick, onMapReady, onMoveEnd }: Props) {
    const map = useMap();

    useEffect(() => {
        if (map && onMapReady) {
            onMapReady(map);
        }
    }, [map, onMapReady]);

    useMapEvents({
        mousemove(e) {
            onMouseMove(e.latlng);
        },
        click(e) {
            onClick?.(e.latlng);
        },
        moveend() {
            if (onMoveEnd) {
                const bounds = map.getBounds();
                const center = map.getCenter();
                onMoveEnd(
                    {
                        north: bounds.getNorth(),
                        south: bounds.getSouth(),
                        east: bounds.getEast(),
                        west: bounds.getWest(),
                    },
                    { lat: center.lat, lng: center.lng }
                );
            }
        },
    });
    return null;
}
