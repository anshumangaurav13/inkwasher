// scripts/sync-upstream.js - Safely updates _reference/ from johnowhitaker/inkwash without touching root files
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REF_DIR = path.join(ROOT, '_reference');
const UPSTREAM_URL = 'https://github.com/johnowhitaker/inkwash.git';

console.log('🔄 Syncing upstream (johnowhitaker/inkwash) into _reference/...');

// 1. Ensure upstream remote exists
try {
  const remotes = execSync('git remote', { cwd: ROOT, encoding: 'utf-8' });
  if (!remotes.includes('upstream')) {
    console.log(`Adding remote upstream: ${UPSTREAM_URL}`);
    execSync(`git remote add upstream ${UPSTREAM_URL}`, { cwd: ROOT });
  }
} catch (e) {
  console.error('Failed to configure upstream remote:', e.message);
}

// 2. Fetch upstream main
console.log('Fetching latest commits from upstream/main...');
try {
  execSync('git fetch upstream main', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('Failed to fetch upstream:', e.message);
  process.exit(1);
}

// 3. Ensure _reference directory exists
if (!fs.existsSync(REF_DIR)) {
  fs.mkdirSync(REF_DIR, { recursive: true });
}

// 4. Extract upstream/main tree directly into _reference/ without touching root files
console.log('Extracting upstream files into _reference/...');
try {
  // Use git archive piped to tar to unpack into _reference
  if (process.platform === 'win32') {
    execSync('git archive upstream/main | tar -x -C _reference', { cwd: ROOT, stdio: 'inherit' });
  } else {
    execSync('git archive upstream/main | tar -x -C _reference/', { cwd: ROOT, stdio: 'inherit' });
  }
  console.log('✅ Upstream successfully synced into _reference/! Inkwasher root files are 100% untouched.');
  console.log('Run "git status" to review changes, then commit when ready.');
} catch (e) {
  console.error('Failed to extract upstream files:', e.message);
  process.exit(1);
}
