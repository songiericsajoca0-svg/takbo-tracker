'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import { calculateDistance, calculateCalories, estimateSteps, calculatePace } from '@/utils/calculations';
import { formatTime, formatPace } from '@/utils/formatTime';
import LiveMap from './LiveMap';

export default function RunTracker({ user }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const [stats, setStats] = useState({
    distance: 0, duration: 0, pace: 0, calories: 0, steps: 0
  });
  const [statusMessage, setStatusMessage] = useState('Handa nang tumakbo! Pindutin ang SIMULA');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  
  // GPS - ALWAYS ON
  const { position, error: geoError, isWatching } = useGeolocation();
  const lastPositionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const totalDistanceRef = useRef(0);
  const coordinatesBufferRef = useRef([]);
  const saveIntervalRef = useRef(null);

  // ===== CHECK FOR ACTIVE RUN ON PAGE LOAD =====
  useEffect(() => {
    checkForActiveRun();
  }, [user.id]);

 const checkForActiveRun = async () => {
    try {
      setIsRestoring(true);

      // Check if there's a VERY RECENT active run (within last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'paused'])
        .gte('updated_at', thirtySecondsAgo) // Only recent runs
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No recent active run - OK, normal lang
          setIsRestoring(false);
          setStatusMessage('Handa nang tumakbo! Pindutin ang SIMULA');
          return;
        }
        throw error;
      }

      if (data) {
        // Only restore if the run was updated within last 30 seconds
        // This means the user just refreshed, not a stuck run from yesterday
        const lastUpdate = new Date(data.updated_at || data.created_at);
        const now = new Date();
        const secondsSinceUpdate = (now - lastUpdate) / 1000;
        
        if (secondsSinceUpdate > 30) {
          // Stuck run - mark as completed
          await supabase
            .from('runs')
            .update({ 
              status: 'completed', 
              end_time: new Date().toISOString() 
            })
            .eq('id', data.id);
          
          setIsRestoring(false);
          setStatusMessage('Handa nang tumakbo! Pindutin ang SIMULA');
          return;
        }

        // Restore the run
        setCurrentRun(data);
        setIsRunning(true);
        setIsPaused(data.status === 'paused');
        totalDistanceRef.current = data.distance_km || 0;
        startTimeRef.current = Date.now() - ((data.duration_seconds || 0) * 1000);

        // Calculate stats
        const dist = data.distance_km || 0;
        const dur = data.duration_seconds || 0;
        const timeMin = dur / 60;
        setStats({
          distance: dist,
          duration: dur,
          pace: calculatePace(dist, timeMin),
          calories: calculateCalories(dist, timeMin),
          steps: estimateSteps(dist)
        });

        await loadExistingCoordinates(data.id);

        setIsRestoring(false);
        setStatusMessage(
          data.status === 'paused' 
            ? '⏸️ Na-restore. Pindutin ang ITULOY.'
            : '🏃‍♂️ Nagpapatuloy ang pagtakbo!'
        );
      }
    } catch (error) {
      console.error('Error checking active run:', error);
      setIsRestoring(false);
      setStatusMessage('Handa nang tumakbo! Pindutin ang SIMULA');
    }
  };

  const loadExistingCoordinates = async (runId) => {
    try {
      const { data } = await supabase
        .from('run_coordinates')
        .select('latitude, longitude')
        .eq('run_id', runId)
        .order('timestamp', { ascending: true });

      if (data && data.length > 0) {
        setRouteCoordinates(data.map(c => [c.latitude, c.longitude]));
        const last = data[data.length - 1];
        lastPositionRef.current = {
          latitude: last.latitude,
          longitude: last.longitude,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error('Error loading coordinates:', error);
    }
  };

  // Update stats display
  const updateStats = useCallback(() => {
    if (!startTimeRef.current) return;
    const duration = (Date.now() - startTimeRef.current) / 1000;
    const timeMinutes = duration / 60;
    const distance = totalDistanceRef.current;
    setStats({
      distance,
      duration,
      pace: calculatePace(distance, timeMinutes),
      calories: calculateCalories(distance, timeMinutes),
      steps: estimateSteps(distance)
    });
  }, []);

  // Timer
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(updateStats, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, isPaused, updateStats]);

  // Track position for running
  useEffect(() => {
    if (!isRunning || isPaused || !position) return;
    
    const newCoord = [position.latitude, position.longitude];
    setRouteCoordinates(prev => [...prev, newCoord]);
    coordinatesBufferRef.current.push(newCoord);
    
    if (lastPositionRef.current?.latitude) {
      const distance = calculateDistance(
        lastPositionRef.current.latitude,
        lastPositionRef.current.longitude,
        position.latitude,
        position.longitude
      );
      
      if (distance > 0 && distance < 0.5) {
        totalDistanceRef.current += distance;
      }
    }
    
    lastPositionRef.current = {
      latitude: position.latitude,
      longitude: position.longitude,
      timestamp: Date.now()
    };
  }, [position, isRunning, isPaused]);

  // Save coordinates periodically
  useEffect(() => {
    if (!isRunning || isPaused || !currentRun) return;
    
    saveIntervalRef.current = setInterval(async () => {
      if (coordinatesBufferRef.current.length > 0) {
        const coords = [...coordinatesBufferRef.current];
        coordinatesBufferRef.current = [];
        
        try {
          await supabase.from('run_coordinates').insert(
            coords.map(c => ({
              run_id: currentRun.id,
              latitude: c[0],
              longitude: c[1],
              timestamp: new Date().toISOString()
            }))
          );
        } catch (err) {
          coordinatesBufferRef.current = [...coords, ...coordinatesBufferRef.current];
        }
      }
    }, 5000);
    
    return () => clearInterval(saveIntervalRef.current);
  }, [isRunning, isPaused, currentRun]);

 // Update DB every 5 seconds
useEffect(() => {
    if (!isRunning || !currentRun) return;
    
    const interval = setInterval(async () => {
      try {
        await supabase
          .from('runs')
          .update({
            distance_km: parseFloat(totalDistanceRef.current.toFixed(3)),
            duration_seconds: Math.floor((Date.now() - startTimeRef.current) / 1000),
            steps_count: estimateSteps(totalDistanceRef.current),
            status: isPaused ? 'paused' : 'active',
            updated_at: new Date().toISOString() // Important!
          })
          .eq('id', currentRun.id);
      } catch (err) {
        console.error('Update error:', err);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isRunning, isPaused, currentRun]);

  const startRun = async () => {
    try {
      const { data: run, error } = await supabase
        .from('runs')
        .insert({
          user_id: user.id,
          start_time: new Date().toISOString(),
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRun(run);
      setIsRunning(true);
      setIsPaused(false);
      totalDistanceRef.current = 0;
      lastPositionRef.current = position ? {
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: Date.now()
      } : null;
      startTimeRef.current = Date.now();
      setRouteCoordinates([]);
      coordinatesBufferRef.current = [];
      
      setStatusMessage('🏃‍♂️ Tumakbo na!');
    } catch (error) {
      setStatusMessage('❌ Error: ' + error.message);
    }
  };

 const pauseRun = async () => {
    setIsPaused(true);
    clearInterval(timerRef.current);
    clearInterval(saveIntervalRef.current);
    
    // Save coordinates
    if (coordinatesBufferRef.current.length > 0 && currentRun) {
      await supabase.from('run_coordinates').insert(
        coordinatesBufferRef.current.map(c => ({
          run_id: currentRun.id,
          latitude: c[0],
          longitude: c[1],
          timestamp: new Date().toISOString()
        }))
      );
      coordinatesBufferRef.current = [];
    }

    // Update status with updated_at
    if (currentRun) {
      await supabase
        .from('runs')
        .update({ 
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentRun.id);
    }
    
    setStatusMessage('⏸️ Naka-pause');
  };

  const resumeRun = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now() - (stats.duration * 1000);
    
    if (currentRun) {
      supabase.from('runs').update({ status: 'active' }).eq('id', currentRun.id);
    }
    
    setStatusMessage('🏃‍♂️ Tuloy ang pagtakbo!');
  };

  const stopRun = async () => {
    try {
      setIsRunning(false);
      setIsPaused(false);
      clearInterval(timerRef.current);
      clearInterval(saveIntervalRef.current);

      if (coordinatesBufferRef.current.length > 0 && currentRun) {
        await supabase.from('run_coordinates').insert(
          coordinatesBufferRef.current.map(c => ({
            run_id: currentRun.id,
            latitude: c[0],
            longitude: c[1],
            timestamp: new Date().toISOString()
          }))
        );
        coordinatesBufferRef.current = [];
      }

      if (currentRun) {
        const timeMinutes = stats.duration / 60;
        await supabase
          .from('runs')
          .update({
            end_time: new Date().toISOString(),
            status: 'completed',
            distance_km: parseFloat(stats.distance.toFixed(3)),
            duration_seconds: Math.floor(stats.duration),
            pace_min_per_km: parseFloat(stats.pace.toFixed(2)),
            calories_burned: stats.calories,
            steps_count: stats.steps
          })
          .eq('id', currentRun.id);
      }

      setStatusMessage(`✅ Tapos! ${stats.distance.toFixed(2)}km`);
      setShowSaveForm(true);
      
    } catch (error) {
      setStatusMessage('❌ Error: ' + error.message);
    }
  };

  const saveFavoriteRoute = async () => {
    if (!routeName.trim()) return alert('Lagyan ng pangalan!');
    
    try {
      await supabase.from('favorite_routes').insert({
        user_id: user.id,
        route_name: routeName.trim(),
        route_coordinates: routeCoordinates,
        total_distance_km: parseFloat(stats.distance.toFixed(3))
      });

      setShowSaveForm(false);
      setRouteName('');
      resetAll();
      alert('✅ Na-save!');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const loadFavoriteRoutes = async () => {
    const { data } = await supabase
      .from('favorite_routes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSavedRoutes(data || []);
    setShowFavorites(true);
  };

  const resetAll = () => {
    setCurrentRun(null);
    lastPositionRef.current = null;
    totalDistanceRef.current = 0;
    startTimeRef.current = null;
    setStats({ distance: 0, duration: 0, pace: 0, calories: 0, steps: 0 });
    setRouteCoordinates([]);
    setSelectedFavorite(null);
    coordinatesBufferRef.current = [];
    
    setTimeout(() => setStatusMessage('Handa nang tumakbo! Pindutin ang SIMULA'), 2000);
  };

  // GPS accuracy info
  const gpsAccuracy = position?.accuracy || 0;
  const hasGPS = !!position;

  return (
    <div style={{ background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
      
      {/* Restoring */}
      {isRestoring && (
        <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '10px', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold', color: '#f57c00' }}>
          🔄 Nire-restore...
        </div>
      )}

      {/* MAP - Always shows GPS */}
      <LiveMap 
        currentPosition={position}
        routeCoordinates={selectedFavorite?.route_coordinates || routeCoordinates}
        isRunning={isRunning && !isPaused}
        isReplay={!!selectedFavorite}
      />

      {/* GPS Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderRadius: '8px',
        marginBottom: '12px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        background: hasGPS ? (gpsAccuracy < 20 ? '#e8f5e9' : '#fff3e0') : '#ffebee',
        color: hasGPS ? (gpsAccuracy < 20 ? '#2e7d32' : '#f57c00') : '#c62828'
      }}>
        <span>
          {hasGPS ? `🛰️ GPS: ±${gpsAccuracy.toFixed(1)}m` : '📡 Walang GPS signal'}
        </span>
        <span>
          {hasGPS ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Naghahanap...'}
        </span>
      </div>

      {/* Favorite Info */}
      {selectedFavorite && (
        <div style={{ background: '#e3f2fd', padding: '10px', borderRadius: '10px', marginBottom: '12px', textAlign: 'center' }}>
          <strong>⭐ {selectedFavorite.route_name}</strong> - {selectedFavorite.total_distance_km?.toFixed(2)} km
          <button onClick={() => { setSelectedFavorite(null); setRouteCoordinates([]); }}
            style={{ marginLeft: '10px', padding: '4px 10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '0.75rem' }}>
            ✕
          </button>
        </div>
      )}

      {/* Save Form */}
      {showSaveForm && (
        <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '10px', marginBottom: '12px' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 8px 0' }}>💾 I-save bilang paborito?</p>
          <input type="text" placeholder="Pangalan ng ruta" value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '8px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveFavoriteRoute} style={{ flex: 1, padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              ✅ I-save
            </button>
            <button onClick={() => { setShowSaveForm(false); resetAll(); }}
              style={{ flex: 1, padding: '10px', background: '#ccc', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
              ❌ Huwag
            </button>
          </div>
        </div>
      )}

      {/* Favorites */}
      {showFavorites && (
        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '12px', maxHeight: '250px', overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 10px 0' }}>⭐ Paborito</h4>
          {savedRoutes.map(r => (
            <div key={r.id} onClick={() => { setSelectedFavorite(r); setRouteCoordinates(r.route_coordinates); setShowFavorites(false); }}
              style={{ padding: '8px', background: 'white', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', border: '1px solid #e0e0e0' }}>
              <strong>{r.route_name}</strong> - {r.total_distance_km?.toFixed(2)} km
            </div>
          ))}
          <button onClick={() => setShowFavorites(false)}
            style={{ width: '100%', padding: '10px', background: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}>
            Isara
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
        <StatCard label="DISTANSYA" value={stats.distance.toFixed(2)} unit="km" />
        <StatCard label="ORAS" value={formatTime(stats.duration)} unit="min:sec" />
        <StatCard label="PACE" value={formatPace(stats.pace)} unit="min/km" />
        <StatCard label="CALORIES" value={stats.calories} unit="kcal" />
      </div>

      {/* Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: isRunning ? '1fr 2fr' : '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
        {!isRunning ? (
          <>
            <button onClick={startRun} style={greenBtn}>▶ SIMULA</button>
            <button onClick={loadFavoriteRoutes} style={{ ...greenBtn, background: '#FF9800' }}>⭐ Favorites</button>
          </>
        ) : (
          <>
            <button onClick={isPaused ? resumeRun : pauseRun}
              style={{ padding: '15px', background: isPaused ? '#4CAF50' : '#FF9800', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              {isPaused ? '▶ Ituloy' : '⏸ Hinto'}
            </button>
            <button onClick={stopRun}
              style={{ padding: '15px', background: '#f44336', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
              ⏹ TAPOS
            </button>
          </>
        )}
      </div>

      {/* Status */}
      <div style={{
        padding: '10px', borderRadius: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem',
        background: isRestoring ? '#fff3e0' : !isRunning ? '#e3f2fd' : isPaused ? '#fff3e0' : '#e8f5e9',
        color: isRestoring ? '#f57c00' : !isRunning ? '#1976d2' : isPaused ? '#f57c00' : '#2e7d32'
      }}>
        {statusMessage}
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #667eea15, #764ba215)', padding: '15px', borderRadius: '15px' }}>
      <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold' }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#333' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#666' }}>{unit}</div>
    </div>
  );
}

const greenBtn = {
  padding: '15px',
  background: '#4CAF50',
  color: 'white',
  border: 'none',
  borderRadius: '12px',
  fontSize: '1.1rem',
  fontWeight: 'bold',
  cursor: 'pointer'
};