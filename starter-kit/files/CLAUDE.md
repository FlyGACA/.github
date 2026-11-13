# CLAUDE.md

## What this is

<!-- One short paragraph: what the project is, who uses it, where it runs. -->

## Commands

<!-- The exact commands to install, build, test and run. Claude runs these, so they must work from a clean checkout. -->

```bash
```

## Rules

- Work on a new branch per task. Never push to or merge into the default branch.
- Open pull requests as drafts; the owner decides when to merge.
- Never commit secrets. `.env*` is git-ignored, except `.env.example`.
- Do not change production, payments, storage, domains or any hosting setting without the owner's approval, and do not
  say something is live from the repository alone: check the service.
- Aviation and regulatory content follows `.claude/rules/aviation-content.md`.
- Do not modify another repository without the owner's permission.

## Claude Code setup

`.claude/` holds this repository's Claude Code configuration, installed from the FlyGACA starter kit:

- `settings.json` denies reading `.env*` files and runs `hooks/guard-git.sh` on every Bash command. The hook refuses
  pushes to `main` or `master`, plain force-pushes and remote-branch deletes. It is a guard rail for slips, not a
  security boundary: protect the default branch with a ruleset on GitHub as well.
- `rules/` holds short rules. A rule with a `paths:` list loads only when Claude touches a matching file.
- `workflows/review-change.js` is a saved workflow (`/review-change`) that reviews the current change in parallel and
  has a skeptic try to refute every finding. It spends agents, so run it deliberately.
- Personal overrides go in `CLAUDE.local.md` and `.claude/settings.local.json`, which are git-ignored.

<!-- Add this project's own rules above, and path-scoped ones in .claude/rules/. Delete this comment. -->
