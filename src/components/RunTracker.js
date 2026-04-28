'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useGeolocation } from '@/hooks/useGeolocation';
import { calculateDistance, calculateCalories, estimateSteps, calculatePace } from '@/utils/calculations';
import { formatTime, formatPace } from '@/utils/formatTime';
import toast from 'react-hot-toast';

export default function RunTracker({ user }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRun, setCurrentRun] = useState(null);
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    pace: 0,
    calories: 0,
    steps: 0
  });
  
  const { position, error: geoError, startWatching, stopWatching } = useGeolocation();
  const lastPositionRef = useRef(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const totalDistanceRef = useRef(0);

  // Calculate stats
  const updateStats = () => {
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
  };

  // Track position updates
  useEffect(() => {
    if (!isRunning || isPaused || !position) return;

    if (lastPositionRef.current) {
      const distance = calculateDistance(
        lastPositionRef.current.latitude,
        lastPositionRef.current.longitude,
        position.latitude,
        position.longitude
      );
      totalDistanceRef.current += distance;
      
      // Save coordinate every 10 seconds to reduce API calls
      if (Math.floor(Date.now() / 1000) % 10 === 0) {
        saveCoordinate(position);
      }
    }
    
    lastPositionRef.current = position;
  }, [position, isRunning, isPaused]);

  // Timer effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(updateStats, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning, isPaused]);

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
      lastPositionRef.current = null;
      startTimeRef.current = Date.now();
      
      startWatching();
      toast.success('Simula na ang pagtakbo! 🏃‍♂️');
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const pauseRun = () => {
    setIsPaused(true);
    stopWatching();
    clearInterval(timerRef.current);
    toast('Naka-pause ⏸️', { icon: '⏸️' });
  };

  const resumeRun = () => {
    setIsPaused(false);
    startWatching();
    startTimeRef.current = Date.now() - (stats.duration * 1000);
    toast('Tuloy ang pagtakbo! ▶️', { icon: '▶️' });
  };

  const stopRun = async () => {
    try {
      setIsRunning(false);
      setIsPaused(false);
      stopWatching();
      clearInterval(timerRef.current);

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

      toast.success(`Tapos na! ${stats.distance.toFixed(2)}km sa ${formatTime(stats.duration)} 🎉`);
      
      setCurrentRun(null);
      lastPositionRef.current = null;
      totalDistanceRef.current = 0;
      setStats({ distance: 0, duration: 0, pace: 0, calories: 0, steps: 0 });
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const saveCoordinate = async (position) => {
    if (!currentRun) return;
    
    await supabase
      .from('run_coordinates')
      .insert({
        run_id: currentRun.id,
        latitude: position.latitude,
        longitude: position.longitude,
        timestamp: new Date().toISOString()
      });
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-xl">
          <div className="text-xs text-gray-600 font-medium">DISTANSYA</div>
          <div className="text-3xl font-bold text-gray-800">{stats.distance.toFixed(2)}</div>
          <div className="text-xs text-gray-600">km</div>
        </div>
        <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-xl">
          <div className="text-xs text-gray-600 font-medium">ORAS</div>
          <div className="text-3xl font-bold text-gray-800">{formatTime(stats.duration)}</div>
          <div className="text-xs text-gray-600">min:sec</div>
        </div>
        <div className="bg-gradient-to-br from-purple-100 to-purple-200 p-4 rounded-xl">
          <div className="text-xs text-gray-600 font-medium">PACE</div>
          <div className="text-3xl font-bold text-gray-800">{formatPace(stats.pace)}</div>
          <div className="text-xs text-gray-600">min/km</div>
        </div>
        <div className="bg-gradient-to-br from-orange-100 to-orange-200 p-4 rounded-xl">
          <div className="text-xs text-gray-600 font-medium">CALORIES</div>
          <div className="text-3xl font-bold text-gray-800">{stats.calories}</div>
          <div className="text-xs text-gray-600">kcal</div>
        </div>
      </div>

      {/* Location Info */}
      {position && (
        <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">📍 Coordinates:</span>
            <span className="font-mono text-xs">
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">👣 Steps:</span>
            <span className="font-bold">{stats.steps.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="grid grid-cols-3 gap-3">
        {!isRunning ? (
          <button
            onClick={startRun}
            className="col-span-3 bg-green-500 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-600 transition transform hover:scale-105"
          >
            ▶ SIMULA
          </button>
        ) : (
          <>
            <button
              onClick={isPaused ? resumeRun : pauseRun}
              className="bg-yellow-500 text-white py-4 rounded-xl font-bold hover:bg-yellow-600 transition"
            >
              {isPaused ? '▶ Ituloy' : '⏸ Hinto'}
            </button>
            <button
              onClick={stopRun}
              className="col-span-2 bg-red-500 text-white py-4 rounded-xl font-bold hover:bg-red-600 transition"
            >
              ⏹ TAPOS
            </button>
          </>
        )}
      </div>

      {/* Status */}
      <div className={`p-4 rounded-xl text-center font-semibold ${
        !isRunning ? 'bg-blue-50 text-blue-700 border border-blue-200' :
        isPaused ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
        'bg-green-50 text-green-700 border border-green-200 animate-pulse-slow'
      }`}>
        {!isRunning && '🟢 Handa nang tumakbo! Pindutin ang SIMULA'}
        {isRunning && isPaused && '🟡 Naka-pause ang pagtakbo'}
        {isRunning && !isPaused && '🔴 Tumakbo na! Sine-save sa database...'}
      </div>

      {/* GPS Error */}
      {geoError && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-center">
          ❌ GPS Error: {geoError}
        </div>
      )}
    </div>
  );
}