'use client';
import { useAuth } from '@/hooks/useAuth';
import Auth from '@/components/Auth';
import LoadingSpinner from '@/components/LoadingSpinner';
import RunTracker from '@/components/RunTracker';
import RunHistory from '@/components/RunHistory';

export default function Home() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Auth />;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* Header */}
     
<div style={{
  background: 'white',
  borderRadius: '20px',
  padding: '20px',
  marginBottom: '20px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}}>
  <div>
    <h1 style={{ fontSize: '1.5rem', color: '#333', margin: 0 }}>
      🏃‍♂️ TakboTracker
    </h1>
    <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '0.85rem' }}>
      👤 {user.user_metadata?.full_name || user.email?.split('@')[0]}
    </p>
    <p style={{ color: '#999', margin: '2px 0 0 0', fontSize: '0.7rem' }}>
      🔒 Private Dashboard • Ikaw lang ang may access
    </p>
  </div>
  <button
    onClick={signOut}
    style={{
      padding: '10px 18px',
      background: '#f44336',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontWeight: 'bold',
      fontSize: '0.85rem'
    }}
  >
    🚪 Logout
  </button>
</div>

        {/* Run Tracker */}
        <div style={{ marginBottom: '20px' }}>
          <RunTracker user={user} />
        </div>

        {/* Run History */}
        <RunHistory user={user} />
      </div>
    </div>
  );
}