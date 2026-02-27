/**
 * MapEventsWrapper — client component that wraps the useMapEvents hook.
 *
 * useMapEvents is a React hook and CANNOT be dynamically imported via next/dynamic.
 * This component is loaded client-side by the parent page via:
 *   const MapEventsWrapper = dynamic(() => import('@/components/map/MapEventsWrapper'), { ssr: false })
 */
"use client"

import { useMapEvents } from 'react-leaflet';

interface Props {
    onMouseMove: (pos: { lat: number; lng: number }) => void;
}

export default function MapEventsWrapper({ onMouseMove }: Props) {
    useMapEvents({
        mousemove(e) {
            onMouseMove(e.latlng);
        },
    });
    return null;
}
