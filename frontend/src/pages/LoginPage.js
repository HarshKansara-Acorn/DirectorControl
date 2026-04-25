import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Eye, EyeOff, LogIn, ShieldCheck, ArrowLeft,
  RefreshCw, UserPlus, Mail, CheckCircle, Copy, ExternalLink
} from 'lucide-react';
import api from '../services/api';
import styles from './LoginPage.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// Password strength helper
// ─────────────────────────────────────────────────────────────────────────────
const getStrength = (p) => {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8)              s++;
  if (/[A-Z]/.test(p))           s++;
  if (/[0-9]/.test(p))           s++;
  if (/[^A-Za-z0-9]/.test(p))   s++;
  return s;
};
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a'];

// ─────────────────────────────────────────────────────────────────────────────
// Tab switcher
// ─────────────────────────────────────────────────────────────────────────────
const TabBar = ({ active, onChange }) => (
  <div className={styles.tabBar}>
    <button
      className={`${styles.tab} ${active === 'signin' ? styles.tabActive : ''}`}
      onClick={() => onChange('signin')}
      type="button"
    >
      <LogIn size={15} /> Sign In
    </button>
    <button
      className={`${styles.tab} ${active === 'signup' ? styles.tabActive : ''}`}
      onClick={() => onChange('signup')}
      type="button"
    >
      <UserPlus size={15} /> Sign Up
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Sign In form
// ─────────────────────────────────────────────────────────────────────────────
const SignInForm = ({ onSuccess, onRequires2FA, onForgotPassword }) => {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requiresTwoFA) {
        onRequires2FA(result.tempToken);
      } else {
        onSuccess(result);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Email Address</label>
        <input
          type="email" className={styles.input}
          placeholder="you@acornuniversalconsultancy.com"
          value={email} onChange={e => setEmail(e.target.value)}
          required autoFocus autoComplete="email"
        />
      </div>

      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label className={styles.label}>Password</label>
          <button type="button" className={styles.forgotLink} onClick={onForgotPassword}>
            Forgot password?
          </button>
        </div>
        <div className={styles.passwordWrapper}>
          <input
            type={showPassword ? 'text' : 'password'} className={styles.input}
            placeholder="Enter your password"
            value={password} onChange={e => setPassword(e.target.value)}
            required autoComplete="current-password"
          />
          <button type="button" className={styles.eyeBtn}
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? <span className={styles.loadingText}>Signing in...</span>
                 : <><LogIn size={18} /><span>Sign In</span></>}
      </button>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up form
// ─────────────────────────────────────────────────────────────────────────────
const SignUpForm = ({ onSignedUp }) => {
  const [form, setForm]                 = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw]             = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const s = getStrength(form.password);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/register', {
        name: form.name,
        email: form.email,
        password: form.password,
        confirmPassword: form.confirm,
      });
      onSignedUp(form.email);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally { setLoading(false); }
  };

  const rules = [
    { ok: form.password.length >= 8,            label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(form.password),          label: 'One uppercase letter' },
    { ok: /[0-9]/.test(form.password),          label: 'One number' },
    { ok: /[^A-Za-z0-9]/.test(form.password),  label: 'One special character' },
  ];

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Full Name</label>
        <input
          type="text" className={styles.input} name="name"
          placeholder="e.g. Dhruval Patel"
          value={form.name} onChange={handleChange}
          required autoFocus autoComplete="name"
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Email Address</label>
        <input
          type="email" className={styles.input} name="email"
          placeholder="you@acornuniversalconsultancy.com"
          value={form.email} onChange={handleChange}
          required autoComplete="email"
        />
        <span className={styles.fieldHint}>Must be an @acornuniversalconsultancy.com address</span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Password</label>
        <div className={styles.passwordWrapper}>
          <input
            type={showPw ? 'text' : 'password'} className={styles.input} name="password"
            placeholder="Create a strong password"
            value={form.password} onChange={handleChange}
            required autoComplete="new-password"
          />
          <button type="button" className={styles.eyeBtn}
            onClick={() => setShowPw(v => !v)} aria-label="Toggle password">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {form.password && (
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
        <label className={styles.label}>Confirm Password</label>
        <div className={styles.passwordWrapper}>
          <input
            type={showConfirm ? 'text' : 'password'} className={styles.input} name="confirm"
            placeholder="Repeat your password"
            value={form.confirm} onChange={handleChange}
            required autoComplete="new-password"
          />
          <button type="button" className={styles.eyeBtn}
            onClick={() => setShowConfirm(v => !v)} aria-label="Toggle confirm password">
            {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {form.confirm && form.password !== form.confirm && (
          <span className={styles.fieldError}>Passwords do not match</span>
        )}
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? <span className={styles.loadingText}>Creating account...</span>
                 : <><UserPlus size={18} /><span>Create Account</span></>}
      </button>
    </form>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up success screen
// ─────────────────────────────────────────────────────────────────────────────
const SignUpSuccess = ({ email, onSignIn }) => (
  <div className={styles.successBox}>
    <div className={styles.successIcon}>✅</div>
    <h3 className={styles.successTitle}>Account Created!</h3>
    <p className={styles.successDesc}>
      Your account for <strong>{email}</strong> has been created successfully.
      You can now sign in with your credentials.
    </p>
    <button className={styles.submitBtn} onClick={onSignIn}>
      <LogIn size={16} /> Sign In Now
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Forgot Password form
// ─────────────────────────────────────────────────────────────────────────────
const ForgotPasswordForm = ({ onBack }) => {
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null); // { resetLink, name, expiresIn }
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate reset link');
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.resetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (result) {
    return (
      <div className={styles.resetLinkBox}>
        <div className={styles.resetLinkIcon}>🔑</div>
        <h3 className={styles.resetLinkTitle}>Reset Link Generated</h3>
        {result.name && (
          <p className={styles.resetLinkDesc}>Hi <strong>{result.name}</strong>, use the link below to reset your password. It expires in <strong>{result.expiresIn}</strong>.</p>
        )}

        <div className={styles.resetLinkField}>
          <span className={styles.resetLinkText}>{result.resetLink}</span>
          <button className={styles.copyBtn} onClick={handleCopy} title="Copy link">
            {copied ? <CheckCircle size={14} color="#16a34a" /> : <Copy size={14} />}
          </button>
        </div>

        <a href={result.resetLink} className={styles.openLinkBtn} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} /> Open Reset Page
        </a>

        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} /> Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <>
      <div className={styles.stepHeader}>
        <div className={styles.stepIconForgot}><Mail size={20} /></div>
        <h2 className={styles.stepTitle}>Forgot Password</h2>
        <p className={styles.stepDesc}>Enter your email to get a password reset link</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Email Address</label>
          <input
            type="email" className={styles.input}
            placeholder="you@acornuniversalconsultancy.com"
            value={email} onChange={e => setEmail(e.target.value)}
            required autoFocus autoComplete="email"
          />
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? <span className={styles.loadingText}>Generating link...</span>
                   : <><Mail size={16} /><span>Get Reset Link</span></>}
        </button>

        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={14} /> Back to Sign In
        </button>
      </form>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2FA step
// ─────────────────────────────────────────────────────────────────────────────
const TwoFAStep = ({ tempToken, onSuccess, onBack }) => {
  const { finaliseLogin } = useAuth();
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (code.replace(/\s/g, '').length === 6) handleVerify();
  }, [code]); // eslint-disable-line

  const handleVerify = async () => {
    const clean = code.replace(/\s/g, '');
    if (clean.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login/2fa', { tempToken, code: clean });
      finaliseLogin(res.data.token, res.data.user);
      onSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
      setCode('');
      inputRef.current?.focus();
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className={styles.stepHeader}>
        <div className={styles.stepIcon2fa}><ShieldCheck size={22} /></div>
        <h2 className={styles.stepTitle}>Two-Factor Authentication</h2>
        <p className={styles.stepDesc}>Enter the 6-digit code from your authenticator app</p>
      </div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Authenticator Code</label>
          <input
            ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*"
            className={`${styles.input} ${styles.codeInput}`}
            placeholder="000000" value={code}
            onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
            maxLength={6} autoComplete="one-time-code"
          />
          <span className={styles.codeHint}>Code refreshes every 30 seconds</span>
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}

        <button type="button" className={styles.submitBtn}
          onClick={handleVerify} disabled={loading || code.length < 6}>
          {loading ? <span className={styles.loadingText}>Verifying...</span>
                   : <><ShieldCheck size={18} /><span>Verify & Sign In</span></>}
        </button>

        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={15} /> Use a different account
        </button>
      </div>

      <div className={styles.twoFAInfo}>
        <RefreshCw size={13} />
        <span>Can't access your authenticator? Contact your administrator to reset 2FA.</span>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main LoginPage
// ─────────────────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const [tab, setTab]             = useState('signin');  // 'signin' | 'signup'
  const [screen, setScreen]       = useState('main');    // 'main' | '2fa' | 'forgot' | 'signupDone'
  const [tempToken, setTempToken] = useState(null);
  const [signedUpEmail, setSignedUpEmail] = useState('');

  const handleLoginSuccess = (userData) => {
    navigate(userData.role === 'director' ? '/director/dashboard' : '/dashboard');
  };

  const show2FA = (token) => { setTempToken(token); setScreen('2fa'); };
  const showMain = () => { setScreen('main'); setTempToken(null); };

  // Show step indicator only during 2FA
  const show2FAIndicator = screen === '2fa';

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.logoIcon}>DC</div>
          <h1 className={styles.brandName}>DirectorControl</h1>
          <p className={styles.brandTagline}>Executive Management Dashboard</p>
        </div>

        {/* 2FA step indicator */}
        {show2FAIndicator && (
          <div className={styles.stepIndicator}>
            <div className={`${styles.stepDot} ${styles.stepDotDone}`} />
            <div className={`${styles.stepLine} ${styles.stepLineDone}`} />
            <div className={`${styles.stepDot} ${styles.stepDotActive}`} />
          </div>
        )}

        {/* Tab bar — only on main screen */}
        {screen === 'main' && (
          <TabBar active={tab} onChange={t => { setTab(t); }} />
        )}

        {/* ── Screens ── */}
        {screen === 'main' && tab === 'signin' && (
          <SignInForm
            onSuccess={handleLoginSuccess}
            onRequires2FA={show2FA}
            onForgotPassword={() => setScreen('forgot')}
          />
        )}

        {screen === 'main' && tab === 'signup' && (
          <SignUpForm
            onSignedUp={(email) => { setSignedUpEmail(email); setScreen('signupDone'); }}
          />
        )}

        {screen === 'signupDone' && (
          <SignUpSuccess
            email={signedUpEmail}
            onSignIn={() => { setScreen('main'); setTab('signin'); }}
          />
        )}

        {screen === 'forgot' && (
          <ForgotPasswordForm onBack={() => setScreen('main')} />
        )}

        {screen === '2fa' && (
          <TwoFAStep
            tempToken={tempToken}
            onSuccess={handleLoginSuccess}
            onBack={showMain}
          />
        )}
      </div>
    </div>
  );
};

export default LoginPage;
