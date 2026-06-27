import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import { getBaseURL } from '../../services/api';
import '../../index.css';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');
  const email = queryParams.get('email');

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid or missing password reset link.');
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const baseUrl = getBaseURL();
        const response = await fetch(`${baseUrl}/auth/verify-reset-token?token=${token}&email=${encodeURIComponent(email)}`);
        
        if (!response.ok) {
          throw new Error('This password reset link is invalid or has expired.');
        }
        setIsValidating(false);
      } catch (err) {
        setError(err.message);
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setIsLoading(true);

    try {
      const baseUrl = getBaseURL();
      const response = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong. Please try again.');
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (pass) => {
    let score = 0;
    if (!pass) return { score, color: 'var(--text-secondary)', text: 'None' };
    if (pass.length > 7) score += 1;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^a-zA-Z\d]/.test(pass)) score += 1;
    
    switch (score) {
      case 0:
      case 1: return { score, color: 'var(--danger)', text: 'Weak' };
      case 2:
      case 3: return { score, color: 'var(--warning)', text: 'Medium' };
      case 4: return { score, color: 'var(--success)', text: 'Strong' };
      default: return { score: 0, color: 'var(--text-secondary)', text: 'None' };
    }
  };

  const strength = getPasswordStrength(password);

  if (isValidating) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" style={{ border: '4px solid rgba(255,255,255,0.1)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '20px' }}>
      <GlassCard style={{ maxWidth: '450px', width: '100%', padding: '40px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '50%', marginBottom: '15px' }}>
            <Lock size={32} color="var(--primary)" />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>Reset Password</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
            Create a new strong password for your account.
          </p>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', marginBottom: '15px' }}>
              <CheckCircle2 size={32} color="var(--success)" />
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>Password Updated!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '25px', lineHeight: '1.5' }}>
              Your password has been changed successfully. You can now log in with your new password.
            </p>
            <button 
              className="primary-btn" 
              style={{ width: '100%' }}
              onClick={() => navigate('/login')}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '12px 15px', borderRadius: '4px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: 'var(--danger)', fontSize: '14px', lineHeight: '1.4' }}>{error}</span>
              </div>
            )}

            {!error || error.includes('match') || error.includes('characters') ? (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>New Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 45px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 0 }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {password && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <div style={{ flex: 1, display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4].map(idx => (
                          <div key={idx} style={{ height: '4px', flex: 1, borderRadius: '2px', background: idx <= strength.score ? strength.color : 'rgba(255,255,255,0.1)', transition: 'background 0.3s ease' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '12px', color: strength.color, fontWeight: '500', width: '45px', textAlign: 'right' }}>{strength.text}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                      <Lock size={18} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      style={{
                        width: '100%',
                        padding: '12px 15px 12px 45px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="primary-btn" 
                  style={{ width: '100%', position: 'relative' }}
                  disabled={isLoading || !password || !confirmPassword || strength.score < 4}
                >
                  {isLoading ? (
                    <div className="spinner" style={{ border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid white', borderRadius: '50%', width: '20px', height: '20px', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                  ) : 'Reset Password'}
                </button>
              </>
            ) : (
              <button 
                type="button" 
                className="secondary-btn" 
                style={{ width: '100%' }}
                onClick={() => navigate('/forgot-password')}
              >
                Request New Link
              </button>
            )}
          </form>
        )}
      </GlassCard>
    </div>
  );
};

export default ResetPassword;
