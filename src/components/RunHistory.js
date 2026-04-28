'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTime, formatPace, formatDate } from '@/utils/formatTime';

export default function RunHistory({ user }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
    
    // Real-time subscription
    const channel = supabase
      .channel('runs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'runs',
          filter: `user_id=eq.${user.id}`
        },
        () => loadRuns()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const loadRuns = async () => {
    try {
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setRuns(data || []);
    } catch (error) {
      console.error('Error loading runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-700',
      paused: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-blue-100 text-blue-700'
    };
    return badges[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl animate-spin">⚡</div>
        <p className="text-gray-500 mt-2">Naglo-load ng kasaysayan...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">📊 Kasaysayan ng Pagtakbo</h2>
        <span className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
          {runs.length} runs
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-3">🏃‍♂️</div>
          <p className="text-gray-600 font-medium">Wala pang naitalang pagtakbo</p>
          <p className="text-gray-500 text-sm mt-1">Magsimula na para makita dito!</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-gray-50 p-4 rounded-xl hover:bg-gray-100 transition border border-gray-200"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-gray-500">
                  {formatDate(run.start_time)}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(run.status)}`}>
                  {run.status === 'active' && '🔴 Active'}
                  {run.status === 'paused' && '🟡 Paused'}
                  {run.status === 'completed' && '✅ Done'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">
                    {run.distance_km?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-gray-600">km</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">
                    {formatTime(run.duration_seconds || 0)}
                  </div>
                  <div className="text-xs text-gray-600">oras</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">
                    {formatPace(run.pace_min_per_km || 0)}
                  </div>
                  <div className="text-xs text-gray-600">pace</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-800">
                    {run.calories_burned || 0}
                  </div>
                  <div className="text-xs text-gray-600">kcal</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}