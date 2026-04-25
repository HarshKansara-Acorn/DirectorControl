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

const commitMessage = `style: use original Bg-DirectorControl.png as login background (unmodified)

- Copied Bg-DirectorControl.png to frontend/src/assets/login-bg.png unchanged
- Removed hand-drawn SVG replacement
- CSS now references the real image via url('../assets/login-bg.png')
- Updated fallback gradient to match image palette (near-white to light blue)
- Frosted glass card with backdrop-filter blur(18px)`;

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
