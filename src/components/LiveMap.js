'use client';
import { useEffect, useRef, useState } from 'react';

let mapCounter = 0;

export default function LiveMap({ currentPosition, routeCoordinates, isRunning, isReplay = false }) {
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const startMarkerRef = useRef(null);
  const currentMarkerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const containerRef = useRef(null);
  const mapIdRef = useRef(`map-${++mapCounter}`);
  const [mapReady, setMapReady] = useState(false);

  // Initialize map ONCE
  useEffect(() => {
    const mapId = mapIdRef.current;

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const initMapWhenReady = () => {
      if (window.L && containerRef.current && !isInitializedRef.current) {
        initMap(window.L, mapId);
      }
    };

    if (window.L) {
      setTimeout(initMapWhenReady, 200);
    } else {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMapWhenReady;
      script.onerror = () => console.error('Failed to load Leaflet');
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {}
        mapInstanceRef.current = null;
        isInitializedRef.current = false;
        setMapReady(false);
      }
    };
  }, []);

  // Update map data when props change
  useEffect(() => {
    if (mapInstanceRef.current && window.L && isInitializedRef.current && mapReady) {
      updateMapDisplay(window.L);
    }
  }, [currentPosition, routeCoordinates, isRunning, isReplay, mapReady]);

  // Function to recenter map to current position
  const recenterMap = () => {
    if (!mapInstanceRef.current || !currentPosition) return;
    
    const map = mapInstanceRef.current;
    map.setView([currentPosition.latitude, currentPosition.longitude], 17, {
      animate: true,
      duration: 1
    });
    
    // Flash effect on button
    const btn = document.getElementById(`recenter-btn-${mapIdRef.current}`);
    if (btn) {
      btn.style.transform = 'scale(0.9)';
      setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
    }
  };

  const initMap = (L, mapId) => {
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer || mapInstanceRef.current || isInitializedRef.current) return;

    const defaultCenter = currentPosition 
      ? [currentPosition.latitude, currentPosition.longitude]
      : [14.5995, 120.9842];

    try {
      const map = L.map(mapId, {
        center: defaultCenter,
        zoom: 17,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        minZoom: 3
      }).addTo(map);

      // Add locate control
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      isInitializedRef.current = true;

      // Force resize after init
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          updateMapDisplay(L);
          setMapReady(true);
        }
      }, 500);

      // Handle map click - stop auto-follow
      map.on('dragstart', () => {
        // User is manually moving the map
      });

    } catch (error) {
      console.error('Map init error:', error);
      isInitializedRef.current = false;
    }
  };

  const updateMapDisplay = (L) => {
    const map = mapInstanceRef.current;
    if (!map || !isInitializedRef.current) return;

    try {
      // Clear existing overlays safely
      if (polylineRef.current) {
        try { map.removeLayer(polylineRef.current); } catch (e) {}
        polylineRef.current = null;
      }
      if (startMarkerRef.current) {
        try { map.removeLayer(startMarkerRef.current); } catch (e) {}
        startMarkerRef.current = null;
      }
      if (currentMarkerRef.current) {
        try { map.removeLayer(currentMarkerRef.current); } catch (e) {}
        currentMarkerRef.current = null;
      }

      // Create icons
      const startIcon = L.divIcon({
        html: '<div style="background:#4CAF50;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">S</div>',
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const endIcon = L.divIcon({
        html: '<div style="background:#f44336;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">E</div>',
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const currentIcon = L.divIcon({
        html: '<div style="background:#2196F3;width:24px;height:24px;border-radius:50%;border:4px solid white;box-shadow:0 2px 15px rgba(33,150,243,0.7);animation:pulse 2s infinite;"></div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      let hasRoute = false;

      // Draw polyline
      if (routeCoordinates && routeCoordinates.length >= 2) {
        const latlngs = routeCoordinates.map(coord => {
          if (Array.isArray(coord) && coord.length >= 2) return [coord[0], coord[1]];
          if (coord?.latitude && coord?.longitude) return [coord.latitude, coord.longitude];
          return null;
        }).filter(c => c !== null && !isNaN(c[0]) && !isNaN(c[1]));

        if (latlngs.length >= 2) {
          hasRoute = true;
          
          polylineRef.current = L.polyline(latlngs, {
            color: '#667eea',
            weight: 6,
            opacity: 0.8,
            smoothFactor: 1.5
          }).addTo(map);

          startMarkerRef.current = L.marker(latlngs[0], { icon: startIcon })
            .addTo(map)
            .bindPopup('<b>🏁 Simula</b>');

          if (!isRunning && !isReplay) {
            const last = latlngs[latlngs.length - 1];
            currentMarkerRef.current = L.marker(last, { icon: endIcon })
              .addTo(map)
              .bindPopup('<b>🏁 Tapos</b>');
          }

          // Fit bounds only on initial load, not during running
          if (!isRunning || routeCoordinates.length < 5) {
            try {
              const bounds = L.latLngBounds(latlngs);
              map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
            } catch (e) {}
          }
        }
      }

      // Current position marker for live tracking
      if (currentPosition && isRunning) {
        const pos = [currentPosition.latitude, currentPosition.longitude];
        
        // Remove old current marker if exists
        if (currentMarkerRef.current) {
          try { map.removeLayer(currentMarkerRef.current); } catch (e) {}
        }
        
        currentMarkerRef.current = L.marker(pos, { icon: currentIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup('<b>📍 Ikaw ay narito</b>');
        
        // Only auto-center if map hasn't been manually moved
        if (!hasRoute && map.getCenter()) {
          map.setView(pos, 17, { animate: true, duration: 1 });
        }
      } else if (currentPosition && !hasRoute) {
        const pos = [currentPosition.latitude, currentPosition.longitude];
        
        if (currentMarkerRef.current) {
          try { map.removeLayer(currentMarkerRef.current); } catch (e) {}
        }
        
        currentMarkerRef.current = L.marker(pos, { icon: currentIcon })
          .addTo(map)
          .bindPopup('<b>📍 Ikaw ay narito</b>');
        map.setView(pos, 17, { animate: true, duration: 0.5 });
      }

    } catch (error) {
      console.error('Map update error:', error);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '380px', 
        borderRadius: '15px', 
        overflow: 'hidden',
        marginBottom: '15px',
        border: '2px solid #e0e0e0',
        backgroundColor: '#e8e8e8',
        position: 'relative'
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }
        @keyframes flash {
          0% { transform: scale(1); }
          50% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .leaflet-control-zoom {
          border-radius: 8px !important;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2) !important;
        }
        .leaflet-control-zoom a {
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 3px 15px rgba(0,0,0,0.2) !important;
        }
        .leaflet-popup-content {
          margin: 10px 14px !important;
          font-size: 13px !important;
        }
      `}</style>
      
      <div id={mapIdRef.current} style={{ height: '100%', width: '100%' }} />
      
      {/* Recenter Button */}
      {currentPosition && mapReady && (
        <button
          id={`recenter-btn-${mapIdRef.current}`}
          onClick={recenterMap}
          title="Hanapin ang lokasyon ko"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            zIndex: 1000,
            background: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#2196F3',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2196F3';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#2196F3';
          }}
        >
          <span style={{ fontSize: '18px' }}>📍</span>
          <span style={{ fontSize: '13px' }}>Hanapin Ako</span>
        </button>
      )}
      
      {/* Map status indicator */}
      {currentPosition && mapReady && !isRunning && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#666',
          boxShadow: '0 1px 5px rgba(0,0,0,0.15)'
        }}>
          🟢 GPS Ready
        </div>
      )}
      
      {currentPosition && mapReady && isRunning && (
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(76,175,80,0.95)',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '11px',
          color: 'white',
          boxShadow: '0 1px 5px rgba(0,0,0,0.15)',
          animation: 'pulse 2s infinite'
        }}>
          🔴 LIVE Tracking
        </div>
      )}
      
      {/* Loading */}
      {!mapReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.95)',
          padding: '20px 30px',
          borderRadius: '15px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🗺️</div>
          <div style={{ fontSize: '0.9rem', color: '#666' }}>Naglo-load ang mapa...</div>
        </div>
      )}

      {/* No GPS */}
      {!currentPosition && mapReady && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255,255,255,0.95)',
          padding: '20px 30px',
          borderRadius: '15px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📡</div>
          <div style={{ fontSize: '0.9rem', color: '#f44336', fontWeight: 'bold' }}>Walang GPS Signal</div>
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>
            Siguraduhing naka-on ang location
          </div>
        </div>
      )}
    </div>
  );
}