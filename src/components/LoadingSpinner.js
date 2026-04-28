export default function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
      <div className="text-center">
        <div className="text-6xl animate-bounce">🏃‍♂️</div>
        <p className="text-white mt-4 text-xl">Naglo-load...</p>
      </div>
    </div>
  );
}