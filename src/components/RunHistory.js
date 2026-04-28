'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTime, formatPace, formatDate } from '@/utils/formatTime';
import LiveMap from './LiveMap';

export default function RunHistory({ user }) {
  const [runs, setRuns] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [selectedFavorite, setSelectedFavorite] = useState(null);
  const [runCoordinates, setRunCoordinates] = useState([]);
  const [loadingCoordinates, setLoadingCoordinates] = useState(false);
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'favorites'

  useEffect(() => {
    loadRuns();
    loadFavorites();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('runs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'runs', filter: `user_id=eq.${user.id}` },
        () => {
          loadRuns();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'favorite_routes', filter: `user_id=eq.${user.id}` },
        () => {
          loadFavorites();
        }
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

  const loadFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorite_routes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

const viewRunOnMap = async (run) => {
  if (selectedRun?.id === run.id) {
    setSelectedRun(null);
    setRunCoordinates([]);
    return;
  }

  setSelectedRun(run);
  setSelectedFavorite(null);
  setLoadingCoordinates(true);

  try {
    const { data, error } = await supabase
      .from('run_coordinates')
      .select('latitude, longitude')
      .eq('run_id', run.id)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    // Force update kahit walang data
    setRunCoordinates(data || []);
    setLoadingCoordinates(false);
    
  } catch (error) {
    console.error('Error loading coordinates:', error);
    setRunCoordinates([]);
    setLoadingCoordinates(false);
  }
};

  const viewFavoriteOnMap = (favorite) => {
    if (selectedFavorite?.id === favorite.id) {
      setSelectedFavorite(null);
      setRunCoordinates([]);
      return;
    }

    setSelectedFavorite(favorite);
    setSelectedRun(null);

    // Parse coordinates from JSON
    if (favorite.route_coordinates) {
      const coords = typeof favorite.route_coordinates === 'string' 
        ? JSON.parse(favorite.route_coordinates) 
        : favorite.route_coordinates;
      setRunCoordinates(coords);
    }
  };

  const deleteFavorite = async (id) => {
    if (!confirm('Sigurado kang gusto mong tanggalin ang paboritong ruta na ito?')) return;

    try {
      const { error } = await supabase
        .from('favorite_routes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSelectedFavorite(null);
      setRunCoordinates([]);
      loadFavorites();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: '#e8f5e9', color: '#2e7d32', text: '🔴 Active' },
      paused: { bg: '#fff3e0', color: '#f57c00', text: '🟡 Paused' },
      completed: { bg: '#e3f2fd', color: '#1976d2', text: '✅ Done' }
    };
    return badges[status] || { bg: '#f5f5f5', color: '#666', text: status };
  };

  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
          <p style={{ color: '#666' }}>Naglo-load ng kasaysayan...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'white',
      borderRadius: '20px',
      padding: '20px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '15px'
      }}>
        <button
          onClick={() => {
            setActiveTab('history');
            setSelectedRun(null);
            setSelectedFavorite(null);
            setRunCoordinates([]);
          }}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'history' ? '#667eea' : '#f0f0f0',
            color: activeTab === 'history' ? 'white' : '#666'
          }}
        >
          📊 History ({runs.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('favorites');
            setSelectedRun(null);
            setSelectedFavorite(null);
            setRunCoordinates([]);
          }}
          style={{
            flex: 1,
            padding: '10px',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'favorites' ? '#FF9800' : '#f0f0f0',
            color: activeTab === 'favorites' ? 'white' : '#666'
          }}
        >
          ⭐ Favorites ({favorites.length})
        </button>
      </div>

      {/* Map Preview (shows when run or favorite is selected) */}
      {(selectedRun || selectedFavorite) && (
        <div style={{ marginBottom: '15px' }}>
          <div style={{
            background: selectedFavorite ? '#fff3e0' : '#e3f2fd',
            padding: '10px',
            borderRadius: '10px 10px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>
                {selectedFavorite ? '⭐ ' + selectedFavorite.route_name : '📍 Run Details'}
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '10px' }}>
                {selectedFavorite 
                  ? selectedFavorite.total_distance_km?.toFixed(2) + ' km'
                  : selectedRun.distance_km?.toFixed(2) + ' km • ' + formatTime(selectedRun.duration_seconds || 0)
                }
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedRun(null);
                setSelectedFavorite(null);
                setRunCoordinates([]);
              }}
              style={{
                background: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                padding: '5px 10px',
                cursor: 'pointer',
                fontSize: '0.8rem'
              }}
            >
              ✕ Close
            </button>
          </div>

          {loadingCoordinates ? (
            <div style={{
              height: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f8f9fa',
              borderRadius: '0 0 10px 10px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem' }}>🗺️</div>
                <p style={{ color: '#666' }}>Naglo-load ng ruta...</p>
              </div>
            </div>
          ) : runCoordinates.length > 0 ? (
            <LiveMap
              currentPosition={null}
              routeCoordinates={runCoordinates}
              isRunning={false}
              isReplay={true}
            />
          ) : (
            <div style={{
              height: '200px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f8f9fa',
              borderRadius: '0 0 10px 10px',
              textAlign: 'center'
            }}>
              <div>
                <p style={{ color: '#666', margin: 0 }}>📍 Walang na-save na coordinates para sa run na ito</p>
                <p style={{ color: '#999', fontSize: '0.85rem', margin: '5px 0 0 0' }}>
                  Siguraduhing naka-on ang GPS habang tumatakbo
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History List */}
      {activeTab === 'history' && (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem' }}>🏃‍♂️</div>
              <p style={{ color: '#666' }}>Wala pang naitalang pagtakbo</p>
            </div>
          ) : (
            runs.map((run) => {
              const badge = getStatusBadge(run.status);
              const isSelected = selectedRun?.id === run.id;
              
              return (
                <div
                  key={run.id}
                  onClick={() => viewRunOnMap(run)}
                  style={{
                    background: isSelected ? '#e3f2fd' : '#f8f9fa',
                    padding: '15px',
                    borderRadius: '12px',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #667eea' : '1px solid #e0e0e0',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '10px'
                  }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                      {formatDate(run.start_time)}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '3px 10px',
                      borderRadius: '10px',
                      background: badge.bg,
                      color: badge.color,
                      fontWeight: 'bold'
                    }}>
                      {badge.text}
                    </span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '10px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                        {run.distance_km?.toFixed(2) || '0.00'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>km</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                        {formatTime(run.duration_seconds || 0)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>oras</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                        {formatPace(run.pace_min_per_km || 0)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>pace</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                        {run.calories_burned || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#666' }}>kcal</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{
                      textAlign: 'center',
                      marginTop: '10px',
                      color: '#667eea',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}>
                      👆 Kita ang ruta sa mapa sa itaas
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Favorites List */}
      {activeTab === 'favorites' && (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ fontSize: '3rem' }}>⭐</div>
              <p style={{ color: '#666' }}>Wala pang paboritong ruta</p>
              <p style={{ color: '#999', fontSize: '0.85rem' }}>
                Mag-save ng ruta pagkatapos tumakbo!
              </p>
            </div>
          ) : (
            favorites.map((fav) => {
              const isSelected = selectedFavorite?.id === fav.id;
              
              return (
                <div
                  key={fav.id}
                  style={{
                    background: isSelected ? '#fff3e0' : '#f8f9fa',
                    padding: '15px',
                    borderRadius: '12px',
                    marginBottom: '10px',
                    border: isSelected ? '2px solid #FF9800' : '1px solid #e0e0e0',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <div style={{ cursor: 'pointer' }} onClick={() => viewFavoriteOnMap(fav)}>
                      <strong style={{ fontSize: '1.1rem' }}>⭐ {fav.route_name}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '3px' }}>
                        {fav.total_distance_km?.toFixed(2)} km
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        {formatDate(fav.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => viewFavoriteOnMap(fav)}
                        style={{
                          padding: '8px 12px',
                          background: isSelected ? '#667eea' : '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        {isSelected ? '👁️ Hide' : '🗺️ View'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFavorite(fav.id);
                        }}
                        style={{
                          padding: '8px 12px',
                          background: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{
                      textAlign: 'center',
                      color: '#FF9800',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}>
                      👆 Kita ang ruta sa mapa sa itaas
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Total Stats */}
      {runs.length > 0 && (
        <div style={{
          marginTop: '15px',
          padding: '15px',
          background: '#f0f0f0',
          borderRadius: '12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#666', fontWeight: 'bold' }}>
            KABUUAN
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '10px' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                {runs.reduce((sum, r) => sum + (r.distance_km || 0), 0).toFixed(1)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>total km</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                {runs.length}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>runs</div>
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
                {runs.reduce((sum, r) => sum + (r.calories_burned || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>kcal</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}