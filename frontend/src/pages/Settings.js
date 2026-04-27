import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Lock, Shield, Smartphone, Link2, Trash2,
  Eye, EyeOff, AlertTriangle, CheckCircle, ChevronRight,
  LogOut, Monitor, Globe
} from 'lucide-react';
import styles from './Settings.module.css';
const Settings = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('password');

  // Auto-open the correct section from URL param (e.g. after Teams OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) setActiveSection(section);
  }, []);

  const sections = [
    { id: 'password',    label: 'Password',           icon: Lock },
    { id: '2fa',         label: 'Two-Factor Auth',    icon: Shield },
    { id: 'sessions',    label: 'Active Sessions',    icon: Monitor },
    { id: 'linked',      label: 'Linked Accounts',    icon: Link2 },
    { id: 'danger',      label: 'Account Actions',    icon: AlertTriangle },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageSubtitle}>Manage your account security and preferences</p>
      </div>

      <div className={styles.layout}>
        {/* Sidebar */}
        <nav className={styles.sidebar}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`${styles.sidebarItem} ${activeSection === id ? styles.sidebarItemActive : ''} ${id === 'danger' ? styles.sidebarItemDanger : ''}`}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={15} />
              <span>{label}</span>
              <ChevronRight size={13} className={styles.sidebarArrow} />
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {activeSection === 'password' && <PasswordSection />}
          {activeSection === '2fa'      && <TwoFASection user={user} updateUser={updateUser} />}
          {activeSection === 'sessions' && <SessionsSection />}
          {activeSection === 'linked'   && <LinkedAccountsSection />}
          {activeSection === 'danger'   && <DangerSection user={user} logout={logout} navigate={navigate} />}
        </div>
      </div>
    </div>
  );
};

// ── Password Section ──────────────────────────────────────────────────────────
const PasswordSection = () => {
  const [form, setForm]     = useState({ current: '', newPass: '', confirm: '' });
  const [show, setShow]     = useState({ current: false, newPass: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState({ type: '', text: '' });

  const strength = (p) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)  s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a'];
  const s = strength(form.newPass);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPass !== form.confirm) return setMsg({ type: 'error', text: 'New passwords do not match' });
    if (form.newPass.length < 8) return setMsg({ type: 'error', text: 'Password must be at least 8 characters' });
    setSaving(true); setMsg({ type: '', text: '' });
    try {
      await api.put('/users/me/password', { currentPassword: form.current, newPassword: form.newPass });
      setMsg({ type: 'success', text: 'Password changed successfully!' });
      setForm({ current: '', newPass: '', confirm: '' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Lock size={18} />
        <div>
          <h2 className={styles.sectionTitle}>Change Password</h2>
          <p className={styles.sectionDesc}>Use a strong password with at least 8 characters</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Current Password</label>
          <div className={styles.passwordField}>
            <input
              className={styles.input}
              type={show.current ? 'text' : 'password'}
              value={form.current}
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              placeholder="Enter current password"
              required
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShow(s => ({ ...s, current: !s.current }))}>
              {show.current ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>New Password</label>
          <div className={styles.passwordField}>
            <input
              className={styles.input}
              type={show.newPass ? 'text' : 'password'}
              value={form.newPass}
              onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))}
              placeholder="Enter new password"
              required
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShow(s => ({ ...s, newPass: !s.newPass }))}>
              {show.newPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {form.newPass && (
            <div className={styles.strengthBar}>
              <div className={styles.strengthTrack}>
                {[1,2,3,4].map(i => (
                  <div key={i} className={styles.strengthSegment} style={{ background: i <= s ? strengthColor[s] : 'var(--border)' }} />
                ))}
              </div>
              <span className={styles.strengthLabel} style={{ color: strengthColor[s] }}>{strengthLabel[s]}</span>
            </div>
          )}
          <div className={styles.passwordRules}>
            {[
              { rule: form.newPass.length >= 8,       label: 'At least 8 characters' },
              { rule: /[A-Z]/.test(form.newPass),     label: 'One uppercase letter' },
              { rule: /[0-9]/.test(form.newPass),     label: 'One number' },
              { rule: /[^A-Za-z0-9]/.test(form.newPass), label: 'One special character' },
            ].map(({ rule, label }) => (
              <div key={label} className={`${styles.rule} ${rule ? styles.ruleMet : ''}`}>
                <CheckCircle size={11} /> {label}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Confirm New Password</label>
          <div className={styles.passwordField}>
            <input
              className={styles.input}
              type={show.confirm ? 'text' : 'password'}
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Confirm new password"
              required
            />
            <button type="button" className={styles.eyeBtn} onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}>
              {show.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {form.confirm && form.newPass !== form.confirm && (
            <span className={styles.fieldError}>Passwords do not match</span>
          )}
        </div>

        {msg.text && (
          <div className={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>{msg.text}</div>
        )}

        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
};

// ── 2FA Section ───────────────────────────────────────────────────────────────
const TwoFASection = ({ user, updateUser }) => {
  const enabled = user?.twoFAEnabled || false;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Shield size={18} />
        <div>
          <h2 className={styles.sectionTitle}>Two-Factor Authentication</h2>
          <p className={styles.sectionDesc}>
            Protect your account with a time-based one-time password (TOTP)
          </p>
        </div>
      </div>

      {enabled
        ? <TwoFADisableFlow updateUser={updateUser} />
        : <TwoFASetupFlow   updateUser={updateUser} />
      }
    </div>
  );
};

// ── Setup flow (3 steps: intro → QR scan → verify) ───────────────────────────
const TwoFASetupFlow = ({ updateUser }) => {
  const [step, setStep]     = useState('intro');   // intro | scan | verify
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/2fa/setup');
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
      setStep('scan');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start 2FA setup');
    } finally { setLoading(false); }
  };

  const handleVerify = async () => {
    const clean = code.replace(/\s/g, '');
    if (clean.length !== 6) { setError('Enter the 6-digit code from your app.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/2fa/verify-setup', { code: clean });
      updateUser({ twoFAEnabled: true });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Try again.');
      setCode('');
    } finally { setLoading(false); }
  };

  if (step === 'done') {
    return (
      <div className={styles.twoFASuccess}>
        <div className={styles.twoFASuccessIcon}>🔐</div>
        <h3 className={styles.twoFASuccessTitle}>2FA is now active</h3>
        <p className={styles.twoFASuccessDesc}>
          Your account is protected. You'll be asked for a code from your authenticator app each time you sign in.
        </p>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className={styles.twoFAFlow}>
        {/* Step indicator */}
        <div className={styles.twoFASteps}>
          <div className={styles.twoFAStep}>
            <div className={`${styles.twoFAStepNum} ${styles.twoFAStepDone}`}>✓</div>
            <span>Generate</span>
          </div>
          <div className={styles.twoFAStepLine} />
          <div className={styles.twoFAStep}>
            <div className={`${styles.twoFAStepNum} ${styles.twoFAStepActive}`}>2</div>
            <span>Scan QR</span>
          </div>
          <div className={styles.twoFAStepLine} />
          <div className={styles.twoFAStep}>
            <div className={styles.twoFAStepNum}>3</div>
            <span>Verify</span>
          </div>
        </div>

        <p className={styles.twoFAInstruction}>
          Open <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or any TOTP app and scan this QR code:
        </p>

        {/* QR Code */}
        <div className={styles.qrWrap}>
          <img src={qrCode} alt="2FA QR Code" className={styles.qrImage} />
        </div>

        {/* Manual entry fallback */}
        <div className={styles.secretRow}>
          <span className={styles.secretLabel}>Can't scan? Enter this key manually:</span>
          <div className={styles.secretBox}>
            <code className={styles.secretCode}>
              {showSecret ? secret : '•'.repeat(secret.length)}
            </code>
            <button
              className={styles.secretToggle}
              onClick={() => setShowSecret(v => !v)}
              type="button"
            >
              {showSecret ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <button className={styles.primaryBtn} onClick={() => setStep('verify')}>
          I've scanned the QR code →
        </button>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className={styles.twoFAFlow}>
        {/* Step indicator */}
        <div className={styles.twoFASteps}>
          <div className={styles.twoFAStep}>
            <div className={`${styles.twoFAStepNum} ${styles.twoFAStepDone}`}>✓</div>
            <span>Generate</span>
          </div>
          <div className={styles.twoFAStepLine} />
          <div className={styles.twoFAStep}>
            <div className={`${styles.twoFAStepNum} ${styles.twoFAStepDone}`}>✓</div>
            <span>Scan QR</span>
          </div>
          <div className={styles.twoFAStepLine} />
          <div className={styles.twoFAStep}>
            <div className={`${styles.twoFAStepNum} ${styles.twoFAStepActive}`}>3</div>
            <span>Verify</span>
          </div>
        </div>

        <p className={styles.twoFAInstruction}>
          Enter the <strong>6-digit code</strong> currently shown in your authenticator app to confirm setup:
        </p>

        <div className={styles.field}>
          <input
            type="text"
            inputMode="numeric"
            className={`${styles.input} ${styles.codeInputLarge}`}
            placeholder="000 000"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
          />
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.twoFAVerifyActions}>
          <button className={styles.cancelBtn} onClick={() => setStep('scan')}>← Back</button>
          <button
            className={styles.primaryBtn}
            onClick={handleVerify}
            disabled={loading || code.length < 6}
          >
            {loading ? 'Verifying...' : 'Confirm & Enable 2FA'}
          </button>
        </div>
      </div>
    );
  }

  // Intro step
  return (
    <div className={styles.twoFAIntro}>
      <div className={styles.twoFACard}>
        <div className={styles.twoFAIcon}>🔓</div>
        <div>
          <div className={styles.twoFAStatus}>
            2FA is currently <strong style={{ color: 'var(--red-text)' }}>Disabled</strong>
          </div>
          <div className={styles.twoFADesc}>
            Your account is protected by password only. Enable 2FA for stronger security.
          </div>
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.infoBox}>
        <Smartphone size={16} />
        <div>
          <strong>How it works</strong>
          <p>After enabling, you'll need your password <em>and</em> a 6-digit code from your authenticator app to sign in. Works with Google Authenticator, Microsoft Authenticator, Authy, and any TOTP-compatible app.</p>
        </div>
      </div>

      <button className={styles.primaryBtn} onClick={handleStartSetup} disabled={loading}>
        {loading ? 'Setting up...' : '🔐 Enable Two-Factor Authentication'}
      </button>
    </div>
  );
};

// ── Disable flow — requires password + current TOTP code ─────────────────────
const TwoFADisableFlow = ({ updateUser }) => {
  const [password, setPassword] = useState('');
  const [code, setCode]         = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [confirm, setConfirm]   = useState(false);

  const handleDisable = async () => {
    if (!password) { setError('Enter your current password.'); return; }
    if (code.replace(/\s/g, '').length !== 6) { setError('Enter the 6-digit code from your app.'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/2fa/disable', { password, code: code.replace(/\s/g, '') });
      updateUser({ twoFAEnabled: false });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.twoFAIntro}>
      <div className={styles.twoFACard} style={{ background: 'var(--green-bg)', borderColor: 'var(--green-border)' }}>
        <div className={styles.twoFAIcon}>🔐</div>
        <div>
          <div className={styles.twoFAStatus}>
            2FA is currently <strong style={{ color: 'var(--green-text)' }}>Enabled</strong>
          </div>
          <div className={styles.twoFADesc}>
            Your account is protected with two-factor authentication.
          </div>
        </div>
      </div>

      {!confirm ? (
        <button className={styles.dangerBtn} onClick={() => setConfirm(true)}>
          Disable Two-Factor Authentication
        </button>
      ) : (
        <div className={styles.twoFADisableBox}>
          <p className={styles.twoFADisableWarning}>
            ⚠️ Disabling 2FA reduces your account security. Enter your password and current authenticator code to confirm.
          </p>

          <div className={styles.field}>
            <label className={styles.label}>Current Password</label>
            <div className={styles.passwordField}>
              <input
                className={styles.input}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Your password"
                autoComplete="current-password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPw(v => !v)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Authenticator Code</label>
            <input
              className={`${styles.input} ${styles.codeInputLarge}`}
              type="text"
              inputMode="numeric"
              value={code}
              onChange={e => { setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <div className={styles.twoFAVerifyActions}>
            <button className={styles.cancelBtn} onClick={() => { setConfirm(false); setError(''); setPassword(''); setCode(''); }}>
              Cancel
            </button>
            <button className={styles.dangerBtn} onClick={handleDisable} disabled={loading}>
              {loading ? 'Disabling...' : 'Yes, Disable 2FA'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sessions Section ──────────────────────────────────────────────────────────
const SessionsSection = () => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    api.get('/users/me/sessions').then(r => setSessions(r.data)).catch(() => {});
  }, []);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Monitor size={18} />
        <div>
          <h2 className={styles.sectionTitle}>Active Sessions</h2>
          <p className={styles.sectionDesc}>Devices currently signed into your account</p>
        </div>
      </div>

      <div className={styles.sessionList}>
        {sessions.map(s => (
          <div key={s.id} className={styles.sessionCard}>
            <div className={styles.sessionIcon}><Monitor size={20} /></div>
            <div className={styles.sessionInfo}>
              <div className={styles.sessionDevice}>{s.device}</div>
              <div className={styles.sessionMeta}>
                <span><Globe size={11} /> {s.ip}</span>
                <span>Last active: {new Date(s.lastActive).toLocaleString('en-GB')}</span>
              </div>
            </div>
            {s.isCurrent && <span className={styles.currentBadge}>Current</span>}
          </div>
        ))}
      </div>

      <div className={styles.infoBox}>
        <AlertTriangle size={16} />
        <p>If you see a session you don't recognise, change your password immediately.</p>
      </div>
    </div>
  );
};

// ── Linked Accounts Section ───────────────────────────────────────────────────
const LinkedAccountsSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [outlookStatus, setOutlookStatus] = useState(null); // null = loading
  const [connecting, setConnecting]       = useState(false);
  const [msg, setMsg]                     = useState('');

  // Check URL params after OAuth redirect back to /settings?section=linked
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('teamsConnected') === 'true') {
      setMsg('success:Outlook Calendar connected successfully!');
      window.history.replaceState({}, '', '/settings?section=linked');
    }
    if (params.get('teamsError')) {
      setMsg(`error:${decodeURIComponent(params.get('teamsError'))}`);
      window.history.replaceState({}, '', '/settings?section=linked');
    }
  }, []);

  // Fetch Outlook connection status for the current user
  const fetchOutlookStatus = useCallback(async () => {
    try {
      const res = await api.get('/teams/status', { params: { userId: user?.id } });
      setOutlookStatus(res.data);
    } catch {
      setOutlookStatus({ connected: false, configured: false });
    }
  }, [user?.id]);

  useEffect(() => { fetchOutlookStatus(); }, [fetchOutlookStatus]);

  const handleConnect = async () => {
    setConnecting(true); setMsg('');
    try {
      const res = await api.get('/teams/auth/connect', {
        params: { userId: user?.id, returnTo: 'settings' },
      });
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        setMsg('error:Outlook integration not configured. Contact your administrator.');
      }
    } catch (err) {
      setMsg(`error:${err.response?.data?.message || 'Failed to start connection'}`);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setMsg('');
    try {
      await api.post('/teams/auth/disconnect', { userId: user?.id });
      setOutlookStatus(s => ({ ...s, connected: false, msUserEmail: null }));
      setMsg('success:Outlook Calendar disconnected.');
    } catch (err) {
      setMsg(`error:${err.response?.data?.message || 'Failed to disconnect'}`);
    }
  };

  const msgType = msg.startsWith('success:') ? 'success' : msg.startsWith('error:') ? 'error' : '';
  const msgText = msg.replace(/^(success|error):/, '');

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <Link2 size={18} />
        <div>
          <h2 className={styles.sectionTitle}>Linked Accounts</h2>
          <p className={styles.sectionDesc}>Connect your Microsoft account to sync your Outlook Calendar</p>
        </div>
      </div>

      {msgText && (
        <div className={`${msgType === 'success' ? styles.successMsg : styles.errorMsg} ${styles.linkedMsg}`}>
          {msgText}
        </div>
      )}

      <div className={styles.linkedList}>
        {/* ── Microsoft Outlook ── */}
        <div className={`${styles.linkedCard} ${outlookStatus?.connected ? styles.linkedCardConnected : ''}`}>
          <div className={styles.linkedIconWrap}>
            <span className={styles.linkedIcon}>📧</span>
            {outlookStatus?.connected && <span className={styles.linkedConnectedDot} />}
          </div>
          <div className={styles.linkedInfo}>
            <div className={styles.linkedName}>Microsoft Outlook Calendar</div>
            {outlookStatus === null ? (
              <div className={styles.linkedDesc}>Checking status...</div>
            ) : outlookStatus.connected ? (
              <div className={styles.linkedDescConnected}>
                ✓ Connected as <strong>{outlookStatus.msUserEmail}</strong>
                <br />
                <span className={styles.linkedDescSub}>
                  Outlook Calendar is syncing — events appear in the Events tab
                </span>
              </div>
            ) : (
              <div className={styles.linkedDesc}>
                Sign in with your Microsoft account to sync your Outlook Calendar events into the app
                {!outlookStatus?.configured && (
                  <span className={styles.linkedNotConfigured}> · Azure AD not configured</span>
                )}
              </div>
            )}
          </div>
          <div className={styles.linkedActions}>
            {outlookStatus?.connected ? (
              <>
                <button
                  className={styles.linkedViewBtn}
                  onClick={() => navigate('/events')}
                  title="View synced events"
                >
                  View Events
                </button>
                <button
                  className={styles.disconnectBtn}
                  onClick={handleDisconnect}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                className={styles.connectBtn}
                onClick={handleConnect}
                disabled={connecting || outlookStatus === null}
              >
                {connecting ? 'Connecting...' : 'Connect Outlook'}
              </button>
            )}
          </div>
        </div>

        {/* ── Google Calendar (placeholder) ── */}
        <div className={styles.linkedCard}>
          <div className={styles.linkedIconWrap}>
            <span className={styles.linkedIcon}>📅</span>
          </div>
          <div className={styles.linkedInfo}>
            <div className={styles.linkedName}>Google Calendar</div>
            <div className={styles.linkedDesc}>Google Calendar integration — coming soon</div>
          </div>
          <div className={styles.linkedActions}>
            <button className={styles.connectBtn} disabled title="Coming soon">Connect</button>
          </div>
        </div>
      </div>

      {/* Setup note if Azure AD not configured */}
      {outlookStatus && !outlookStatus.configured && (
        <div className={styles.infoBox} style={{ marginTop: 16 }}>
          <AlertTriangle size={16} color="var(--orange-text)" />
          <div>
            <strong>Azure AD not configured</strong>
            <p>
              To enable Outlook integration, ensure <code>AZURE_CLIENT_ID</code>, <code>AZURE_CLIENT_SECRET</code>,
              and <code>AZURE_TENANT_ID</code> are set in <code>backend/.env</code> and the server is restarted.
            </p>
          </div>
        </div>
      )}

      {/* How it works info box */}
      {outlookStatus?.configured && !outlookStatus?.connected && (
        <div className={styles.infoBox} style={{ marginTop: 16 }}>
          <Globe size={16} />
          <div>
            <strong>How it works</strong>
            <p>
              Click <strong>Connect Outlook</strong> to sign in with your Microsoft account.
              Your Outlook Calendar events will be pulled into the <strong>Events</strong> tab automatically.
              Each user connects their own account — your calendar stays private to you.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Danger Zone Section ───────────────────────────────────────────────────────
const DangerSection = ({ user, logout, navigate }) => {
  const [action, setAction]     = useState(null); // 'deactivate' | 'delete'
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleAction = async () => {
    if (!password) return setError('Please enter your password to confirm');
    setLoading(true); setError('');
    try {
      await api.delete('/users/me', { data: { password, action } });
      logout();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <AlertTriangle size={18} color="var(--red-text)" />
        <div>
          <h2 className={styles.sectionTitle} style={{ color: 'var(--red-text)' }}>Account Actions</h2>
          <p className={styles.sectionDesc}>Irreversible actions — proceed with caution</p>
        </div>
      </div>

      <div className={styles.dangerList}>
        {/* Sign out all devices */}
        <div className={styles.dangerCard}>
          <div className={styles.dangerInfo}>
            <div className={styles.dangerTitle}><LogOut size={15} /> Sign Out Everywhere</div>
            <div className={styles.dangerDesc}>Sign out from all devices and sessions</div>
          </div>
          <button className={styles.warningBtn} onClick={() => { logout(); navigate('/login'); }}>
            Sign Out All
          </button>
        </div>

        {/* Deactivate */}
        <div className={styles.dangerCard}>
          <div className={styles.dangerInfo}>
            <div className={styles.dangerTitle}><AlertTriangle size={15} /> Deactivate Account</div>
            <div className={styles.dangerDesc}>Temporarily disable your account. You can reactivate by contacting your administrator.</div>
          </div>
          <button className={styles.warningBtn} onClick={() => { setAction('deactivate'); setPassword(''); setError(''); }}>
            Deactivate
          </button>
        </div>

        {/* Delete */}
        <div className={`${styles.dangerCard} ${styles.dangerCardRed}`}>
          <div className={styles.dangerInfo}>
            <div className={styles.dangerTitle}><Trash2 size={15} /> Delete Account</div>
            <div className={styles.dangerDesc}>Permanently delete your account and all associated data. This cannot be undone.</div>
          </div>
          <button className={styles.deleteBtn} onClick={() => { setAction('delete'); setPassword(''); setError(''); }}>
            Delete Account
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {action && (
        <div className={styles.confirmBox}>
          <div className={styles.confirmTitle}>
            {action === 'delete' ? '⚠️ Confirm Account Deletion' : '⚠️ Confirm Deactivation'}
          </div>
          <p className={styles.confirmDesc}>
            {action === 'delete'
              ? 'This will permanently delete your account and all data. This action cannot be undone.'
              : 'Your account will be deactivated. Contact your administrator to reactivate.'}
          </p>
          <div className={styles.confirmField}>
            <label className={styles.label}>Enter your password to confirm</label>
            <div className={styles.passwordField}>
              <input
                className={styles.input}
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Your current password"
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShow(v => !v)}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {error && <div className={styles.errorMsg}>{error}</div>}
          <div className={styles.confirmActions}>
            <button className={styles.cancelBtn} onClick={() => setAction(null)}>Cancel</button>
            <button
              className={action === 'delete' ? styles.deleteBtn : styles.warningBtn}
              onClick={handleAction}
              disabled={loading}
            >
              {loading ? 'Processing...' : action === 'delete' ? 'Yes, Delete My Account' : 'Yes, Deactivate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
