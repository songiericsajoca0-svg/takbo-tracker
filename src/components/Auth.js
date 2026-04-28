'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [weight, setWeight] = useState('70');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        // ===== LOGIN =====
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });

        if (error) {
          if (error.message.includes('Invalid login')) {
            throw new Error('Maling email o password. Subukan muli.');
          }
          throw error;
        }

        if (!data.user) {
          throw new Error('Hindi maka-login. Subukan muli.');
        }

        setMessage('✅ Welcome back!');
        
      } else {
        // ===== REGISTER =====
        if (password.length < 6) {
          throw new Error('Ang password ay dapat 6 characters o higit pa.');
        }

        if (password !== confirmPassword) {
          throw new Error('Hindi magkatugma ang password at confirm password.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split('@')[0],
              weight_kg: parseFloat(weight) || 70
            }
          }
        });

        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error('Ang email na ito ay may account na. Mag-login na lang.');
          }
          throw error;
        }

        if (data.user) {
          // Update profile with weight
          await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: email.trim(),
              full_name: fullName.trim() || email.split('@')[0],
              weight_kg: parseFloat(weight) || 70
            });

          setMessage('✅ Account created! Pwede ka nang mag-login.');
          setIsLogin(true);
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch (error) {
      setMessage('❌ ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 25px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '5px' }}>🏃‍♂️</div>
          <h1 style={{ fontSize: '2rem', color: '#333', margin: '0 0 5px 0', fontWeight: '800' }}>
            TakboTracker
          </h1>
          <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
            {isLogin ? 'Mag-login sa iyong account' : 'Gumawa ng bagong account'}
          </p>
        </div>

        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: '500',
            background: message.includes('✅') ? '#e8f5e9' : 
                        message.includes('❌') ? '#ffebee' : '#e3f2fd',
            color: message.includes('✅') ? '#2e7d32' : 
                   message.includes('❌') ? '#c62828' : '#1976d2'
          }}>
            {message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Full Name - Register only */}
          {!isLogin && (
            <div>
              <label style={labelStyle}>👤 Pangalan</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
                placeholder="Juan Dela Cruz"
                required={!isLogin}
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label style={labelStyle}>📧 Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="iyong@email.com"
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>🔒 Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, paddingRight: '45px' }}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '4px',
                  lineHeight: 1,
                  color: '#999'
                }}
                title={showPassword ? 'Itago ang password' : 'Ipakita ang password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm Password - Register only */}
          {!isLogin && (
            <div>
              <label style={labelStyle}>🔒 Kumpirmahin ang Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '45px' }}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '4px',
                    lineHeight: 1,
                    color: '#999'
                  }}
                  title={showConfirmPassword ? 'Itago ang password' : 'Ipakita ang password'}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}

          {/* Weight - Register only */}
          {!isLogin && (
            <div>
              <label style={labelStyle}>⚖️ Timbang (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                style={inputStyle}
                placeholder="70"
                min="30"
                max="200"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#b39ddb' : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px',
              transition: 'all 0.3s',
              boxShadow: loading ? 'none' : '0 4px 15px rgba(102,126,234,0.4)'
            }}
          >
            {loading ? (
              <span>⏳ Naglo-load...</span>
            ) : isLogin ? (
              '🔑 Mag-Login'
            ) : (
              '📝 Gumawa ng Account'
            )}
          </button>
        </form>

        {/* Toggle */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            onClick={toggleForm}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? '👈 Walang account? Gumawa dito' : '👈 May account na? Mag-login dito'}
          </button>
        </div>

        {/* Privacy Note */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: '#999',
          marginTop: '20px',
          marginBottom: 0
        }}>
          🔒 Ang iyong data ay ligtas at ikaw lang ang may access
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  color: '#333',
  fontWeight: '600',
  fontSize: '0.9rem'
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  border: '2px solid #e8e8e8',
  borderRadius: '12px',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.3s',
  backgroundColor: '#fafafa',
  boxSizing: 'border-box'
};