'use client';
import { useAuth } from '@/hooks/useAuth';
import Auth from '@/components/Auth';
import RunTracker from '@/components/RunTracker';
import RunHistory from '@/components/RunHistory';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Home() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-800">🏃‍♂️ TakboTracker</h1>
              <p className="text-gray-600 text-sm">
                {user.user_metadata?.full_name || user.email}
              </p>
            </div>
            <button
              onClick={signOut}
              className="px-3 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Run Tracker */}
        <div className="bg-white rounded-2xl shadow-xl p-4">
          <RunTracker user={user} />
        </div>

        {/* Run History */}
        <div className="bg-white rounded-2xl shadow-xl p-4 mb-8">
          <RunHistory user={user} />
        </div>
      </div>
    </div>
  );
}