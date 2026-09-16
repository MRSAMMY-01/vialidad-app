import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReportEvent } from '@/data/mockEvents';
import {
  calculateHaversineDistance,
  playAlertBeep,
  triggerHapticAlert,
} from '@/utils/geoUtils';

const SPEED_THRESHOLD_KMH = 15; // km/h
const PROXIMITY_ALERT_METERS = 400; // meters
const REARM_DISTANCE_METERS = 1000; // meters

export interface ProximityAlertInfo {
  event: ReportEvent;
  distance: number;
  speedKmH: number;
  timestamp: number;
}

export function useProximityAlert(events: ReportEvent[]) {
  const [currentPosition, setCurrentPosition] = useState<{
    lat: number;
    lng: number;
    speedKmH: number;
  } | null>(null);

  const [activeAlert, setActiveAlert] = useState<ProximityAlertInfo | null>(null);

  // Keep track of alerted event IDs to prevent repeated alerts
  const alertedEventIdsRef = useRef<Set<string>>(new Set());

  // Store last position and timestamp for speed fallback calculation
  const lastPositionRef = useRef<{
    lat: number;
    lng: number;
    timestamp: number;
  } | null>(null);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return;
    }

    const handlePositionUpdate = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const now = position.timestamp || Date.now();

      // 1. Determine speed in km/h
      let speedKmH = 0;
      if (
        position.coords.speed !== null &&
        position.coords.speed !== undefined &&
        !Number.isNaN(position.coords.speed) &&
        position.coords.speed > 0
      ) {
        // speed is in m/s, convert to km/h
        speedKmH = position.coords.speed * 3.6;
      } else if (lastPositionRef.current) {
        // Fallback: calculate speed from delta distance and delta time
        const dtSec = (now - lastPositionRef.current.timestamp) / 1000;
        if (dtSec > 0.5) {
          const distM = calculateHaversineDistance(
            lastPositionRef.current.lat,
            lastPositionRef.current.lng,
            lat,
            lng
          );
          speedKmH = (distM / dtSec) * 3.6;
        }
      }

      // Update position state & ref
      lastPositionRef.current = { lat, lng, timestamp: now };
      setCurrentPosition({ lat, lng, speedKmH });

      // 2. Only activate alert mode when in vehicle (speed >= ~15 km/h)
      const isVehicleSpeed = speedKmH >= SPEED_THRESHOLD_KMH;

      // 3. Check distance to active critical events
      const criticalEvents = events.filter(
        (e) => e.severity === 'critico' && e.estado !== 'resuelto'
      );

      // Rearm/clean up alerted events if the user moved > 1km away
      criticalEvents.forEach((e) => {
        const dist = calculateHaversineDistance(lat, lng, e.lat, e.lng);
        if (dist > REARM_DISTANCE_METERS) {
          alertedEventIdsRef.current.delete(e.id);
        }
      });

      // Find closest critical event within 400m
      if (isVehicleSpeed) {
        let closestCritical: { event: ReportEvent; distance: number } | null = null;

        for (const event of criticalEvents) {
          const distance = calculateHaversineDistance(lat, lng, event.lat, event.lng);

          if (distance < PROXIMITY_ALERT_METERS) {
            if (!closestCritical || distance < closestCritical.distance) {
              closestCritical = { event, distance };
            }
          }
        }

        if (closestCritical && !alertedEventIdsRef.current.has(closestCritical.event.id)) {
          // Mark as alerted
          alertedEventIdsRef.current.add(closestCritical.event.id);

          // Trigger audio beep + vibration + visual banner
          playAlertBeep();
          triggerHapticAlert();

          setActiveAlert({
            event: closestCritical.event,
            distance: Math.round(closestCritical.distance),
            speedKmH: Math.round(speedKmH),
            timestamp: Date.now(),
          });
        }
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      console.warn('Proximity tracking geolocation error:', err.message);
    };

    const watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [events]);

  return {
    currentPosition,
    activeAlert,
    dismissAlert,
  };
}
