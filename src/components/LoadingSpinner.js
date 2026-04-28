export default function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ fontSize: '4rem', animation: 'bounce 1s infinite' }}>🏃‍♂️</div>
        <p style={{ fontSize: '1.5rem', marginTop: '1rem' }}>Naglo-load...</p>
      </div>
    </div>
  );
}