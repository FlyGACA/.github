# FlyGACA starter kit

What a new FlyGACA repository starts from, so the rules we already agreed on are written down and checked from the
first commit instead of being remembered.

| File | What it gives the new repository |
| --- | --- |
| `CLAUDE.md` | A skeleton: what it is, the commands, the rules (branch per task, draft PRs, no secrets, no hosting changes without the owner), and a note on the Claude Code setup. |
| `.claude/settings.json` | Denies reading `.env*` files and plain force-push commands, and runs the git guard on every Bash command. |
| `.claude/hooks/guard-git.sh` | Refuses `git push` to `main` or `master`, plain force-pushes and remote-branch deletes. `--force-with-lease` on your own branch is allowed. A guard rail for slips, not a security boundary. |
| `.claude/rules/aviation-content.md` | The content rules from `CONTRIBUTING.md` and the profile: cite the exact GACAR section, never invent figures, independence, English and Arabic kept consistent. |
| `.claude/workflows/review-change.js` | A saved workflow (`/review-change`): five read-only reviewers, then a skeptic per finding. It spends agents, so run it deliberately. |
| `.github/workflows/ci.yml` (with `--stack`) | A CI workflow from `workflow-templates/`, with a read-only token, a timeout and one run per branch at a time. |
| `.gitignore` lines | `CLAUDE.local.md` and `.claude/settings.local.json`. |

Issue and pull request templates, the code of conduct, `CONTRIBUTING.md` and `SECURITY.md` are not copied: every
repository in the organization inherits them from this repository unless it has its own.

## Use it

```bash
starter-kit/install.sh /path/to/new-repo --stack node      # or --stack python; add --branch trunk if the default branch is not main
```

It never overwrites a file that already exists, it says what it added and what it skipped, and it never runs git.
Afterwards: fill in the placeholders in `CLAUDE.md`, add an `Edit(/folder/**)` deny for any generated folder, and
protect the default branch with the ruleset in [`rulesets/`](../rulesets/README.md).

## Check the kit

```bash
starter-kit/selftest.sh     # needs bash, jq, node and python3 with PyYAML; CI runs it on every change here
```

It installs the kit into scratch repositories and checks the result: the files, a second install changing nothing,
existing files being kept, bad input being refused, the hook against pushes it must block and allow, the workflow's
wiring with stubbed agents, and the workflow templates. It does not run the review workflow for real, because that spends agents.
