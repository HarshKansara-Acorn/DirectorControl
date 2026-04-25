/**
 * Commits all changes and pushes to origin/main using simple-git.
 * Run with: node scripts/git-commit-push.js
 */
const simpleGit = require('simple-git');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

// Use the exact git binary — not relying on PATH
const GIT_BINARY = 'C:/Users/Harsh.Kansara/AppData/Local/Programs/Git/bin/git.exe';

const git = simpleGit({
  baseDir: repoRoot,
  binary:  GIT_BINARY,
  maxConcurrentProcesses: 1,
});

const commitMessage = `feat: Teams OAuth, profile photo upload, 2FA TOTP, sign-up/forgot-password, real user names & emails

- Microsoft Teams OAuth2 integration with DB-persisted tokens
- Profile photo upload with canvas crop/resize modal (0-100% zoom)
- Full TOTP 2FA: QR code setup, login challenge, secure disable flow
- Sign Up page with password strength meter and domain restriction
- Forgot Password: secure token generation, reset link shown on screen
- Reset Password page with token validation and single-use enforcement
- Updated user names: Chintan Patel, Dhruval Patel, Gaumish Patel, Umesh Savaliya
- Updated login emails to firstname.lastname@acornuniversalconsultancy.com
- AuthContext refreshes profile from DB on every app load
- Express JSON body limit raised to 10mb for photo uploads
- Director portal: Tasks, Reminders, Approvals pages
- Settings: live Linked Accounts with Teams connect/disconnect
- Project summary document + PDF
- Password reset columns migration`;

async function run() {
  try {
    console.log('📋 Checking git status...');
    const status = await git.status();
    const allFiles = [
      ...status.modified,
      ...status.not_added,
      ...status.created,
      ...status.renamed.map(r => r.to),
    ];

    if (allFiles.length === 0) {
      console.log('✅ Nothing to commit — working tree is clean.');
      return;
    }

    console.log(`📁 Staging ${allFiles.length} changed files...`);
    await git.add('.');

    console.log('💾 Committing...');
    const result = await git.commit(commitMessage);
    console.log('✅ Committed:', result.commit || result.summary?.changes + ' changes');

    console.log('🚀 Pushing to origin/main...');
    await git.push('origin', 'main');
    console.log('✅ Pushed successfully to GitHub → HarshKansara-Acorn/DirectorControl');

  } catch (err) {
    console.error('❌ Git error:', err.message);
    process.exit(1);
  }
}

run();
