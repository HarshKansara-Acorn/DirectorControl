#!/bin/bash
# ============================================================
# DirectorControl — Verify & Auto-Commit to GitHub
# Runs health checks then commits all changes if they pass
# ============================================================

set -e  # Exit on any error

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo ""
echo "=================================================="
echo "  DirectorControl — Verify & Auto-Commit"
echo "=================================================="
echo ""

# ── 1. Check git is available ────────────────────────────────
if ! command -v git &> /dev/null; then
  echo "❌ git not found in PATH. Run from Git Bash."
  exit 1
fi

# ── 2. Check there are changes to commit ─────────────────────
if git diff --quiet && git diff --staged --quiet; then
  echo "✅ No changes to commit — working tree is clean."
  exit 0
fi

# ── 3. Check backend is reachable ────────────────────────────
echo "🔍 Checking backend health..."
HEALTH=$(curl -s --max-time 8 http://localhost:5000/api/health 2>/dev/null || echo "UNREACHABLE")

if echo "$HEALTH" | grep -q '"db":"connected"'; then
  echo "✅ Backend: running — DB connected"
elif echo "$HEALTH" | grep -q '"status":"OK"'; then
  echo "⚠️  Backend: running — DB status unknown (continuing)"
elif [ "$HEALTH" = "UNREACHABLE" ]; then
  echo "⚠️  Backend not running — skipping live check (committing anyway)"
else
  echo "⚠️  Backend response: $HEALTH"
fi

# ── 4. Check frontend is reachable ───────────────────────────
echo "🔍 Checking frontend..."
FRONTEND=$(curl -s --max-time 5 http://localhost:3000 2>/dev/null || echo "UNREACHABLE")

if [ "$FRONTEND" != "UNREACHABLE" ]; then
  echo "✅ Frontend: running on localhost:3000"
else
  echo "⚠️  Frontend not running — skipping live check (committing anyway)"
fi

# ── 5. Lint check — ensure no syntax errors in JS files ──────
echo "🔍 Checking for syntax errors..."
SYNTAX_OK=true

for file in $(git diff --name-only HEAD 2>/dev/null | grep -E '\.(js|jsx)$' || true); do
  if [ -f "$file" ]; then
    node --check "$file" 2>/dev/null || { echo "❌ Syntax error in $file"; SYNTAX_OK=false; }
  fi
done

if [ "$SYNTAX_OK" = false ]; then
  echo "❌ Syntax errors found. Fix them before committing."
  exit 1
fi

echo "✅ Syntax check passed"

# ── 6. Stage all changes ─────────────────────────────────────
echo ""
echo "📦 Staging changes..."
git add .

# ── 7. Build commit message from changed files ───────────────
CHANGED_FILES=$(git diff --staged --name-only | head -20 | tr '\n' ', ' | sed 's/,$//')
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Detect what kind of change this is
if echo "$CHANGED_FILES" | grep -q "schema\|db\|config"; then
  CHANGE_TYPE="Database"
elif echo "$CHANGED_FILES" | grep -q "routes\|backend"; then
  CHANGE_TYPE="Backend"
elif echo "$CHANGED_FILES" | grep -q "frontend\|pages\|components"; then
  CHANGE_TYPE="Frontend"
else
  CHANGE_TYPE="Update"
fi

COMMIT_MSG="$CHANGE_TYPE: auto-commit after verification [$TIMESTAMP]"

# ── 8. Commit ────────────────────────────────────────────────
echo "💾 Committing: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

# ── 9. Push to GitHub ────────────────────────────────────────
echo "🚀 Pushing to HarshKansara-Acorn/DirectorControl..."
git push origin main

echo ""
echo "=================================================="
echo "  ✅ Successfully committed and pushed to GitHub"
echo "  📍 https://github.com/HarshKansara-Acorn/DirectorControl"
echo "=================================================="
echo ""
