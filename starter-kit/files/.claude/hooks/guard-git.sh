#!/usr/bin/env bash
# PreToolUse hook for the Bash tool: refuses the git commands CLAUDE.md forbids.
#   - git push to main or master (named as the destination, or implied by pushing while on that branch)
#   - git push --force / -f (--force-with-lease on your own branch is fine)
#   - deleting a remote branch (git push --delete, git push origin :branch)
# A guard rail against slips, not a security boundary: Claude Code only sees the text of the command, and
# `git -C . push`, `sh -c '...'` or an alias can get around it. The real protection is the branch ruleset on the
# remote (rulesets/README.md in the FlyGACA/.github repository). Needs jq; without it the hook does nothing.
# Exit 2 blocks the command and sends stderr to Claude; exit 0 lets it through.
set -u
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null) || exit 0
[ -n "$cmd" ] || exit 0

block() { echo "Blocked by .claude/hooks/guard-git.sh: $1" >&2; exit 2; }

# Only act on a git push, wherever it sits in a longer line (a && b, a; b, a | b).
push_re='(^|[;&|(]|[[:space:]])git([[:space:]]+-[A-Za-z-]+([ =][^[:space:];&|]+)?)*[[:space:]]+push([[:space:]]|$)'
grep -Eq "$push_re" <<<"$cmd" || exit 0

# Just the arguments of the push: what follows the word "push", up to the next ; & or |.
args=$(sed -E 's/^.*[[:space:]]push([[:space:]]|$)//; s/[;&|].*$//' <<<"$cmd")

grep -Eq '(^|[[:space:]])(--force|-f)([[:space:]]|$)' <<<"$args" \
  && block "force-push. Use --force-with-lease, and only on a branch you created."
grep -Eq '(^|[[:space:]])(--delete|-d)([[:space:]]|$)|(^|[[:space:]]):[A-Za-z0-9._/-]+' <<<"$args" \
  && block "deleting a remote branch needs the owner's approval."
grep -Eq '(^|[[:space:]:+])(refs/heads/)?(main|master)([[:space:]]|$)' <<<"$args" \
  && block "never push to main or master. Push your own branch and open a draft pull request."

# No branch named (git push, git push origin, git push -u origin): git pushes the current branch.
positional=0
for t in $args; do case "$t" in -*) ;; *) positional=$((positional + 1)) ;; esac; done
if [ "$positional" -le 1 ]; then
  branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null || true)
  case "$branch" in
    main|master) block "you are on $branch, so this would push it. Create a branch first." ;;
  esac
fi
exit 0
