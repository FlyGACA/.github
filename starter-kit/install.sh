#!/usr/bin/env bash
# Install the FlyGACA starter kit into a repository: Claude Code settings, rules and a review workflow, and
# optionally a CI workflow.
#   starter-kit/install.sh <target-repo-dir> [--stack node|python] [--branch main]
# It never overwrites a file that is already there (it says which it skipped) and it never runs git: look at the
# result with `git status`, edit the placeholders in CLAUDE.md, and commit it yourself.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
usage() { echo "usage: install.sh <target-repo-dir> [--stack node|python] [--branch main]" >&2; }

target=""; stack=""; branch="main"
while [ $# -gt 0 ]; do
  case "$1" in
    --stack)  [ $# -ge 2 ] || { usage; exit 2; }; stack="$2"; shift 2 ;;
    --branch) [ $# -ge 2 ] || { usage; exit 2; }; branch="$2"; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    -*) echo "unknown option: $1" >&2; usage; exit 2 ;;
    *) [ -z "$target" ] || { usage; exit 2; }; target="$1"; shift ;;
  esac
done
[ -n "$target" ] && [ -d "$target" ] || { usage; exit 2; }
case "$stack" in ""|node|python) ;; *) echo "--stack is node or python" >&2; exit 2 ;; esac
case "$branch" in *[!A-Za-z0-9._/-]*|"") echo "--branch has characters a branch name should not" >&2; exit 2 ;; esac

added=0; skipped=0
put() { # put <source file> <path relative to the target>
  local dest="$target/$2"
  if [ -e "$dest" ]; then echo "skip   $2 (already there)"; skipped=$((skipped + 1)); return; fi
  mkdir -p "$(dirname "$dest")"; cp -p "$1" "$dest"; echo "add    $2"; added=$((added + 1))
}

while IFS= read -r rel; do
  [ "$rel" = "gitignore.additions" ] && continue
  put "$here/files/$rel" "$rel"
done < <(cd "$here/files" && find . -type f | sed 's#^\./##' | LC_ALL=C sort)
[ -f "$target/.claude/hooks/guard-git.sh" ] && chmod +x "$target/.claude/hooks/guard-git.sh"

if [ -n "$stack" ]; then
  tmp="$(mktemp)"; trap 'rm -f "$tmp"' EXIT
  sed "s/[\$]default-branch/$branch/g" "$here/../workflow-templates/$stack-ci.yml" > "$tmp"
  put "$tmp" ".github/workflows/ci.yml"
fi

# .gitignore: add the lines that are missing, never remove or reorder anything.
touch "$target/.gitignore"
while IFS= read -r line; do
  [ -n "$line" ] || continue
  grep -qxF -- "$line" "$target/.gitignore" || { printf '%s\n' "$line" >> "$target/.gitignore"; echo "add    .gitignore: $line"; }
done < "$here/files/gitignore.additions"

echo
echo "$added added, $skipped skipped. Next:"
echo "  1. Fill in the placeholders in CLAUDE.md (what it is, the commands) and add the project's own rules."
echo "  2. Read .claude/settings.json: add Edit denies for any generated folder in this project."
echo "  3. Protect the default branch: see rulesets/README.md in the FlyGACA/.github repository."
[ -n "$stack" ] && echo "  4. The CI job is called 'test'; a ruleset can require that check once it has run green."
exit 0
