'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);

  // AUTO-START watching on mount
  useEffect(() => {
    startWatching();
    return () => {
      stopWatching();
    };
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation ay hindi suportado ng browser mo');
      return;
    }

    // Clear existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setIsWatching(true);
    setError(null);

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp
          };
          
          setPosition(newPos);
          lastPositionRef.current = newPos;
          setError(null);
        },
        (err) => {
          console.warn('GPS watch error:', err.message);
          
          // Don't show error for temporary issues
          if (err.code === 3) {
            // Timeout - just wait for next update
            return;
          }
          
          setError(err.message);
          
          // Auto-retry after delay
          setTimeout(() => {
            if (isWatching) {
              startWatching();
            }
          }, 3000);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } catch (err) {
      console.error('Failed to start GPS watch:', err);
      setError(err.message);
      setIsWatching(false);
    }
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  // Auto-restart GPS if it stops
  useEffect(() => {
    if (!isWatching && !error) {
      const timer = setTimeout(() => {
        startWatching();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isWatching, error, startWatching]);

  // Reconnect if page becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isWatching) {
        startWatching();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isWatching, startWatching]);

  return {
    position,
    error,
    isWatching,
    startWatching,
    stopWatching,
    lastPosition: lastPositionRef.current
  };
}