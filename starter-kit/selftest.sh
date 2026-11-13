#!/usr/bin/env bash
# Checks the starter kit and the workflow templates end to end. Needs bash, jq, node and python3 with PyYAML.
#   starter-kit/selftest.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }

# 1. install into an empty directory, with a CI workflow
mkdir "$tmp/repo"
"$here/install.sh" "$tmp/repo" --stack node --branch trunk > "$tmp/install1.log"
for f in CLAUDE.md .claude/settings.json .claude/hooks/guard-git.sh .claude/rules/aviation-content.md .claude/workflows/review-change.js .github/workflows/ci.yml .gitignore; do
  [ -f "$tmp/repo/$f" ] || fail "$f was not installed"
done
[ -x "$tmp/repo/.claude/hooks/guard-git.sh" ] || fail "the hook is not executable"
jq -e '.permissions.deny | length > 0' "$tmp/repo/.claude/settings.json" >/dev/null || fail "settings.json"
grep -qF '$default-branch' "$tmp/repo/.github/workflows/ci.yml" && fail "the CI template still has its placeholder"
grep -q 'branches: \[trunk\]' "$tmp/repo/.github/workflows/ci.yml" || fail "--branch was not applied"
grep -qx 'CLAUDE.local.md' "$tmp/repo/.gitignore" || fail ".gitignore lines"
ok "install into an empty repository"

# 2. a second run changes nothing and adds nothing twice
cp -r "$tmp/repo" "$tmp/before"
"$here/install.sh" "$tmp/repo" --stack node --branch trunk > "$tmp/install2.log"
diff -r "$tmp/before" "$tmp/repo" >/dev/null || fail "a second install changed files"
grep -q '^0 added' "$tmp/install2.log" || fail "a second install reported additions"
[ "$(grep -cx 'CLAUDE.local.md' "$tmp/repo/.gitignore")" = 1 ] || fail ".gitignore line was duplicated"
ok "install is idempotent"

# 3. existing files are never overwritten
mkdir "$tmp/repo2"; echo "mine" > "$tmp/repo2/CLAUDE.md"; printf 'node_modules/\n' > "$tmp/repo2/.gitignore"
"$here/install.sh" "$tmp/repo2" > /dev/null
[ "$(cat "$tmp/repo2/CLAUDE.md")" = "mine" ] || fail "CLAUDE.md was overwritten"
head -1 "$tmp/repo2/.gitignore" | grep -qx 'node_modules/' || fail ".gitignore was reordered"
ok "existing files are kept"

# 4. bad input is refused
"$here/install.sh" "$tmp/nope" >/dev/null 2>&1 && fail "a missing target was accepted"
"$here/install.sh" "$tmp/repo" --stack ruby >/dev/null 2>&1 && fail "an unknown stack was accepted"
ok "bad input is refused"

# 5. the installed hook blocks what it should
(cd "$tmp/repo" && git init -q -b feature/x .)
run() { printf '%s' "$(jq -n --arg c "$1" '{tool_input:{command:$c}}')" | CLAUDE_PROJECT_DIR="$tmp/repo" "$tmp/repo/.claude/hooks/guard-git.sh" 2>/dev/null && echo 0 || echo $?; }
[ "$(run 'git push -u origin claude/x')" = 0 ] || fail "hook blocked an ordinary push"
[ "$(run 'git push --force-with-lease origin claude/x')" = 0 ] || fail "hook blocked --force-with-lease"
[ "$(run 'git push origin main')" = 2 ] || fail "hook allowed a push to main"
[ "$(run 'git push -f origin claude/x')" = 2 ] || fail "hook allowed a force-push"
ok "the guard hook"

# 6. the workflow parses and its stages are wired (stubbed agents)
node - "$tmp/repo/.claude/workflows/review-change.js" <<'JS'
const fs = require('fs');
(async () => {
  const body = fs.readFileSync(process.argv[2], 'utf8').replace('export const meta', 'const meta');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('agent', 'pipeline', 'parallel', 'phase', 'log', 'args', 'budget', body);
  const pipeline = (items, ...stages) => Promise.all(items.map(async (item, i) => { let prev = item; for (const s of stages) prev = await s(prev, item, i); return prev; }));
  const parallel = (thunks) => Promise.all(thunks.map((t) => t()));
  const logs = [];
  const agent = async (p, o) => o.label === 'review:bilingual' ? null : o.label.startsWith('review:') ? { findings: [{ file: 'a', summary: 's', scenario: 'c' }] } : { real: true, evidence: 'e' };
  const out = await run(agent, pipeline, parallel, () => {}, (m) => logs.push(m), undefined, null);
  if (out.confirmed.length !== 4) throw new Error('expected 4 confirmed findings, got ' + out.confirmed.length);
  if (!logs.some((m) => /1 reviewer\(s\) returned nothing/.test(m))) throw new Error('a missing reviewer was not reported');
})().catch((e) => { console.error(e.message); process.exit(1); });
JS
ok "the review workflow"

# 7. the starter workflow templates are valid, and their jobs are called "test"
python3 - "$root/workflow-templates" <<'PY'
import glob, json, sys, yaml
for f in sorted(glob.glob(sys.argv[1] + '/*.yml')):
    d = yaml.safe_load(open(f))
    assert list(d['jobs']) == ['test'], f + ': the job must be called test'
    assert d['permissions'] == {'contents': 'read'}, f + ': permissions must be read-only'
    p = json.load(open(f.replace('.yml', '.properties.json')))
    assert p['name'] and p['description'] and p['categories'], f
PY
ok "workflow templates"

# 8. the ruleset draft is valid, ships disabled, and only requires what exists
jq -e '.enforcement == "disabled" and (.rules | map(.type) | index("pull_request")) != null' "$root/rulesets/default-branch.json" >/dev/null || fail "ruleset draft"
jq -e '[.rules[] | select(.type == "required_status_checks")] | length == 0' "$root/rulesets/default-branch.json" >/dev/null || fail "the ruleset must not require checks that may not exist yet"
ok "ruleset draft"
echo "all starter-kit checks passed"
