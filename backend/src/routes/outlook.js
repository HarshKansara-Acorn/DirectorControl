const express = require('express');
const router = express.Router();
const outlookService = require('../services/outlookService');
const { authenticateToken } = require('../middleware/auth');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

router.get('/microsoft', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId;
  const returnTo = req.query.returnTo || 'settings';

  if (!directorId) {
    return res.status(400).json({ message: 'directorId is required' });
  }

  if (req.user.role !== 'admin' && req.user.id !== directorId) {
    return res.status(403).json({ message: 'Admin permission required to create a director connection' });
  }

  if (!outlookService.isConfigured()) {
    return res.status(503).json({ message: 'Outlook integration is not configured' });
  }

  try {
    const authUrl = outlookService.getAuthUrlForDirector(directorId, returnTo);
    await outlookService.createPendingConnection(directorId);
    res.json({ authUrl });
  } catch (err) {
    console.error('Outlook auth URL error:', err.message);
    res.status(500).json({ message: 'Failed to build Outlook authorization URL' });
  }
});

router.get('/microsoft/callback', async (req, res) => {
  const { code, state: rawState, error, error_description } = req.query;
  const redirectBase = FRONTEND_URL;
  const defaultPath = '/settings?section=linked';

  if (error) {
    const message = encodeURIComponent(error_description || error || 'Authorization failed');
    return res.redirect(`${redirectBase}${defaultPath}&outlookError=${message}`);
  }

  if (!code || !rawState) {
    return res.redirect(`${redirectBase}${defaultPath}&outlookError=Invalid+callback+parameters`);
  }

  try {
    const state = outlookService.decodeState(rawState);
    const { directorId, returnTo } = state;

    if (!directorId) {
      throw new Error('State missing directorId');
    }

    const tokens = await outlookService.exchangeCodeForTokens(code);
    const profile = await outlookService.getUserProfile(directorId);

    const isValid = await outlookService.validateDirectorEmailMatch(directorId, profile.email);
    if (!isValid) {
      console.warn(`Microsoft profile email mismatch for director ${directorId}: ${profile.email}`);
      return res.redirect(`${redirectBase}${defaultPath}&outlookError=Please+sign+in+with+the+director%27s+Microsoft+account`);
    }

    await outlookService.storeConnectionTokens(directorId, tokens, profile.email, profile.msId);

    const pathMap = {
      'admin': '/dashboard',
      'admin-dashboard': '/admin-dashboard',
      'settings': '/settings?section=linked',
    };
    const returnPath = pathMap[returnTo] || '/settings?section=linked';
    return res.redirect(`${redirectBase}${returnPath}&outlookConnected=true&directorId=${encodeURIComponent(directorId)}`);
  } catch (err) {
    console.error('Outlook callback error:', err.message);
    const message = encodeURIComponent(err.message || 'Outlook authorization failed');
    res.redirect(`${redirectBase}${defaultPath}&outlookError=${message}`);
  }
});

module.exports = router;
