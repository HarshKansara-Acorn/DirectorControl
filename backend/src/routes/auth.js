const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode  = require('qrcode');
const router  = express.Router();
const { query, queryOne, execute, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mapPublicUser = (u) => ({
  id:          u.Id,
  name:        u.Name,
  email:       u.Email,
  role:        u.Role,
  title:       u.Title       || '',
  avatar:      u.Avatar      || '',
  avatarColor: u.AvatarColor || '#1e40af',
  avatarPhoto: u.AvatarPhoto || null,
  twoFAEnabled: u.TwoFAEnabled === true || u.TwoFAEnabled === 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Step 1: validate email + password.
// If 2FA is enabled → return { requiresTwoFA: true, tempToken }
// If 2FA is disabled → return { token, user }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await queryOne(
      'SELECT * FROM DC_Users WHERE LOWER(Email) = LOWER(@email)',
      { email: { type: sql.NVarChar, value: email } }
    );

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Check account is active
    if (user.IsActive === false || user.IsActive === 0)
      return res.status(403).json({ message: 'Account is deactivated. Contact your administrator.' });

    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    // Update last login timestamp
    await execute(
      'UPDATE DC_Users SET LastLoginAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: user.Id } }
    );

    const twoFAEnabled = user.TwoFAEnabled === true || user.TwoFAEnabled === 1;

    if (twoFAEnabled && user.TwoFASecret) {
      // Issue a short-lived temp token (2 minutes) — only valid for the 2FA verify step
      const tempToken = jwt.sign(
        { id: user.Id, step: '2fa_pending' },
        process.env.JWT_SECRET,
        { expiresIn: '2m' }
      );
      return res.json({ requiresTwoFA: true, tempToken });
    }

    // No 2FA — issue full session token
    const token = jwt.sign(
      { id: user.Id, email: user.Email, role: user.Role, name: user.Name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: mapPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login/2fa
// Step 2: validate TOTP code using the temp token from step 1.
// Returns full session token on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login/2fa', async (req, res) => {
  const { tempToken, code } = req.body;

  if (!tempToken || !code)
    return res.status(400).json({ message: 'Temp token and code are required' });

  // Verify the temp token
  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }

  if (decoded.step !== '2fa_pending')
    return res.status(401).json({ message: 'Invalid token' });

  try {
    const user = await queryOne(
      'SELECT * FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: decoded.id } }
    );

    if (!user || !user.TwoFASecret)
      return res.status(401).json({ message: 'Invalid session' });

    // Verify TOTP — allow 1 step window (30s before/after) for clock drift
    const valid = speakeasy.totp.verify({
      secret:   user.TwoFASecret,
      encoding: 'base32',
      token:    code.replace(/\s/g, ''),
      window:   1,
    });

    if (!valid)
      return res.status(401).json({ message: 'Invalid or expired code. Please try again.' });

    // Issue full session token
    const token = jwt.sign(
      { id: user.Id, email: user.Email, role: user.Role, name: user.Name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: mapPublicUser(user) });
  } catch (err) {
    console.error('2FA verify error:', err.message);
    res.status(500).json({ message: 'Server error during 2FA verification' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/2fa/setup
// Generate a new TOTP secret + QR code for the authenticated user.
// Does NOT enable 2FA yet — user must verify first.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT Id, Email, Name, TwoFAEnabled FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name:   `DirectorControl (${user.Email})`,
      issuer: 'Acorn Universal Consultancy',
      length: 20,
    });

    // Store the pending secret (not yet active — user must verify)
    await execute(
      'UPDATE DC_Users SET TwoFASecret=@secret, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      {
        id:     { type: sql.NVarChar, value: req.user.id },
        secret: { type: sql.NVarChar, value: secret.base32 },
      }
    );

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret:    secret.base32,   // for manual entry
      qrCode:    qrDataUrl,       // data URL for <img>
      otpAuthUrl: secret.otpauth_url,
    });
  } catch (err) {
    console.error('2FA setup error:', err.message);
    res.status(500).json({ message: 'Failed to generate 2FA setup' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/2fa/verify-setup
// Confirm the user scanned the QR and can produce a valid code.
// Activates 2FA on success.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/2fa/verify-setup', authenticateToken, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: 'Verification code is required' });

  try {
    const user = await queryOne(
      'SELECT TwoFASecret FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );

    if (!user?.TwoFASecret)
      return res.status(400).json({ message: 'No pending 2FA setup found. Start setup again.' });

    const valid = speakeasy.totp.verify({
      secret:   user.TwoFASecret,
      encoding: 'base32',
      token:    code.replace(/\s/g, ''),
      window:   1,
    });

    if (!valid)
      return res.status(401).json({ message: 'Invalid code. Make sure your authenticator app is synced.' });

    // Activate 2FA
    await execute(
      'UPDATE DC_Users SET TwoFAEnabled=1, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );

    res.json({ message: '2FA enabled successfully', twoFAEnabled: true });
  } catch (err) {
    console.error('2FA verify-setup error:', err.message);
    res.status(500).json({ message: 'Failed to verify 2FA code' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/2fa/disable
// Disable 2FA — requires current password + valid TOTP code for security.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  const { password, code } = req.body;
  if (!password || !code)
    return res.status(400).json({ message: 'Password and authenticator code are required' });

  try {
    const user = await queryOne(
      'SELECT * FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify password
    const pwMatch = await bcrypt.compare(password, user.Password);
    if (!pwMatch) return res.status(401).json({ message: 'Incorrect password' });

    // Verify TOTP
    const valid = speakeasy.totp.verify({
      secret:   user.TwoFASecret,
      encoding: 'base32',
      token:    code.replace(/\s/g, ''),
      window:   1,
    });
    if (!valid) return res.status(401).json({ message: 'Invalid authenticator code' });

    // Disable and clear secret
    await execute(
      'UPDATE DC_Users SET TwoFAEnabled=0, TwoFASecret=NULL, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );

    res.json({ message: '2FA disabled successfully', twoFAEnabled: false });
  } catch (err) {
    console.error('2FA disable error:', err.message);
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// Self-service sign-up. Only 'director' role allowed — admin is pre-seeded.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ message: 'Passwords do not match' });

  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  // Basic password strength: uppercase + number + special char
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
    return res.status(400).json({ message: 'Password must contain an uppercase letter, a number, and a special character' });

  // Only allow @acornuniversalconsultancy.com emails
  const emailLower = email.toLowerCase().trim();
  if (!emailLower.endsWith('@acornuniversalconsultancy.com'))
    return res.status(400).json({ message: 'Only @acornuniversalconsultancy.com email addresses are allowed' });

  try {
    // Check email not already taken
    const existing = await queryOne(
      'SELECT Id FROM DC_Users WHERE LOWER(Email) = @email',
      { email: { type: sql.NVarChar, value: emailLower } }
    );
    if (existing)
      return res.status(409).json({ message: 'An account with this email already exists' });

    const { v4: uuidv4 } = require('uuid');
    const hash = await bcrypt.hash(password, 12);

    // Derive initials from name
    const parts   = name.trim().split(/\s+/);
    const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');

    await execute(
      `INSERT INTO DC_Users (Id, Name, Email, Password, Role, Title, Avatar, IsActive, CreatedAt)
       VALUES (@id, @name, @email, @hash, 'director', 'Director', @avatar, 1, GETUTCDATE())`,
      {
        id:     { type: sql.NVarChar, value: uuidv4() },
        name:   { type: sql.NVarChar, value: name.trim() },
        email:  { type: sql.NVarChar, value: emailLower },
        hash:   { type: sql.NVarChar, value: hash },
        avatar: { type: sql.NVarChar, value: initials.toUpperCase() },
      }
    );

    res.status(201).json({ message: 'Account created successfully. You can now sign in.' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Failed to create account' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Generates a secure reset token and returns the reset link.
// In production this would send an email; here we return the link directly
// since there is no email server configured.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await queryOne(
      'SELECT Id, Name, Email FROM DC_Users WHERE LOWER(Email) = LOWER(@email)',
      { email: { type: sql.NVarChar, value: email } }
    );

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been generated.' });
    }

    // Generate a cryptographically secure token
    const crypto = require('crypto');
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await execute(
      'UPDATE DC_Users SET PasswordResetToken=@token, PasswordResetExpiry=@expiry WHERE Id=@id',
      {
        token:  { type: sql.NVarChar,  value: token },
        expiry: { type: sql.DateTime2, value: expiry },
        id:     { type: sql.NVarChar,  value: user.Id },
      }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink   = `${frontendUrl}/reset-password?token=${token}`;

    // Return the link directly (no email server — internal tool)
    res.json({
      message: 'Password reset link generated successfully.',
      resetLink,          // shown to user on screen
      expiresIn: '1 hour',
      name: user.Name,
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ message: 'Failed to generate reset link' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// Validates the token and sets the new password.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password)
    return res.status(400).json({ message: 'Token and new password are required' });

  if (password !== confirmPassword)
    return res.status(400).json({ message: 'Passwords do not match' });

  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password))
    return res.status(400).json({ message: 'Password must contain an uppercase letter, a number, and a special character' });

  try {
    const user = await queryOne(
      `SELECT Id, PasswordResetExpiry FROM DC_Users
       WHERE PasswordResetToken = @token AND IsActive = 1`,
      { token: { type: sql.NVarChar, value: token } }
    );

    if (!user)
      return res.status(400).json({ message: 'Invalid or already used reset link' });

    if (new Date() > new Date(user.PasswordResetExpiry))
      return res.status(400).json({ message: 'Reset link has expired. Please request a new one.' });

    const hash = await bcrypt.hash(password, 12);

    await execute(
      `UPDATE DC_Users SET
        Password = @hash,
        PasswordResetToken = NULL,
        PasswordResetExpiry = NULL,
        UpdatedAt = GETUTCDATE()
       WHERE Id = @id`,
      {
        hash: { type: sql.NVarChar, value: hash },
        id:   { type: sql.NVarChar, value: user.Id },
      }
    );

    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/validate-reset-token/:token
// Check if a reset token is valid before showing the reset form.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/validate-reset-token/:token', async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT Name, Email, PasswordResetExpiry FROM DC_Users
       WHERE PasswordResetToken = @token AND IsActive = 1`,
      { token: { type: sql.NVarChar, value: req.params.token } }
    );

    if (!user)
      return res.status(400).json({ valid: false, message: 'Invalid reset link' });

    if (new Date() > new Date(user.PasswordResetExpiry))
      return res.status(400).json({ valid: false, message: 'Reset link has expired' });

    res.json({ valid: true, name: user.Name, email: user.Email });
  } catch (err) {
    res.status(500).json({ valid: false, message: 'Failed to validate token' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
