import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Lock, ArrowLeft, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import styles from './LoginPage.module.css';

const getStrength = (p) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)             s++;
  if (/[A-Z]/.test(p))          s++;
  if (/[0-9]/.test(p))          s++;
  if (/[^A-Za-z0-9]/.test(p))  s++;
  return s;
};
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a'];

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [tokenInfo, setTokenInfo]   = useState(null);  // { name, email } or null
  const [tokenError, setTokenError] = useState('');
  const [validating, setValidating] = useState(true);

  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [showCf, setShowCf]         = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [done, setDone]             = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenError('No reset token found. Please request a new link.'); setValidating(false); return; }
    api.get(`/auth/validate-reset-token/${token}`)
      .then(res => { setTokenInfo(res.data); })
      .catch(err => { setTokenError(err.response?.data?.message || 'Invalid or expired reset link.'); })
      .finally(() => setValidating(false));
  }, [token]);

  const s = getStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password, confirmPassword: confirm });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally { setLoading(false); }
  };

  const rules = [
    { ok: password.length >= 8,           label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password),         label: 'One uppercase letter' },
    { ok: /[0-9]/.test(password),         label: 'One number' },
    { ok: /[^A-Za-z0-9]/.test(password),  label: 'One special character' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoIcon}>DC</div>
          <h1 className={styles.brandName}>DirectorControl</h1>
          <p className={styles.brandTagline}>Executive Management Dashboard</p>
        </div>

        {validating && (
          <div className={styles.validatingMsg}>Validating reset link...</div>
        )}

        {!validating && tokenError && (
          <div className={styles.tokenErrorBox}>
            <AlertTriangle size={32} color="#dc2626" />
            <h3 className={styles.tokenErrorTitle}>Link Invalid or Expired</h3>
            <p className={styles.tokenErrorDesc}>{tokenError}</p>
            <button className={styles.submitBtn} onClick={() => navigate('/login')}>
              <ArrowLeft size={15} /> Back to Login
            </button>
          </div>
        )}

        {!validating && !tokenError && !done && (
          <>
            <div className={styles.stepHeader}>
              <div className={styles.stepIconForgot}><Lock size={20} /></div>
              <h2 className={styles.stepTitle}>Reset Password</h2>
              <p className={styles.stepDesc}>
                {tokenInfo?.name ? `Hi ${tokenInfo.name}, set` : 'Set'} your new password below
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPw ? 'text' : 'password'} className={styles.input}
                    placeholder="Create a strong password"
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                    required autoFocus autoComplete="new-password"
                  />
                  <button type="button" className={styles.eyeBtn}
                    onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {password && (
                  <>
                    <div className={styles.strengthBar}>
                      <div className={styles.strengthTrack}>
                        {[1,2,3,4].map(i => (
                          <div key={i} className={styles.strengthSeg}
                            style={{ background: i <= s ? STRENGTH_COLOR[s] : 'var(--border)' }} />
                        ))}
                      </div>
                      <span className={styles.strengthLabel} style={{ color: STRENGTH_COLOR[s] }}>
                        {STRENGTH_LABEL[s]}
                      </span>
                    </div>
                    <div className={styles.ruleList}>
                      {rules.map(r => (
                        <div key={r.label} className={`${styles.rule} ${r.ok ? styles.ruleMet : ''}`}>
                          <CheckCircle size={11} /> {r.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showCf ? 'text' : 'password'} className={styles.input}
                    placeholder="Repeat your password"
                    value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
                    required autoComplete="new-password"
                  />
                  <button type="button" className={styles.eyeBtn}
                    onClick={() => setShowCf(v => !v)} aria-label="Toggle confirm">
                    {showCf ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <span className={styles.fieldError}>Passwords do not match</span>
                )}
              </div>

              {error && <div className={styles.error} role="alert">{error}</div>}

              <button type="submit" className={styles.submitBtn}
                disabled={loading || s < 4 || password !== confirm}>
                {loading ? <span className={styles.loadingText}>Resetting...</span>
                         : <><Lock size={16} /><span>Reset Password</span></>}
              </button>
            </form>
          </>
        )}

        {!validating && !tokenError && done && (
          <div className={styles.successBox}>
            <div className={styles.successIcon}>🔐</div>
            <h3 className={styles.successTitle}>Password Reset!</h3>
            <p className={styles.successDesc}>
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <button className={styles.submitBtn} onClick={() => navigate('/login')}>
              <ArrowLeft size={15} /> Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
