/**
 * Background sync worker for Outlook connected directors.
 * Runs every 5 minutes and persists synced Outlook items into the database.
 */

const { query } = require('../config/db');
const outlookService = require('./outlookService');

const SYNC_INTERVAL_MS = parseInt(process.env.OUTLOOK_SYNC_INTERVAL_MS || '300000', 10);

const runSyncCycle = async () => {
  if (!outlookService.isConfigured()) {
    console.log('🔌 Outlook sync worker disabled: Azure AD not configured');
    return;
  }

  try {
    const connections = await query('SELECT DirectorId FROM OutlookConnections WHERE AccessTokenEncrypted IS NOT NULL');
    for (const row of connections) {
      const directorId = row.DirectorId;
      try {
        await outlookService.syncDirectorData(directorId);
        console.log(`✅ Synced Outlook data for director ${directorId}`);
      } catch (err) {
        console.error(`Outlook sync failed for ${directorId}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Outlook sync worker failed:', err.message);
  }
};

const start = () => {
  if (!outlookService.isConfigured()) {
    console.log('🔌 Outlook sync worker cannot start until Azure AD is configured');
    return;
  }

  runSyncCycle().catch((err) => console.error('Initial Outlook sync failed:', err.message));
  setInterval(() => {
    runSyncCycle().catch((err) => console.error('Scheduled Outlook sync failed:', err.message));
  }, SYNC_INTERVAL_MS);
  console.log(`⏰ Outlook sync worker scheduled every ${SYNC_INTERVAL_MS / 1000} seconds`);
};

module.exports = { start };
