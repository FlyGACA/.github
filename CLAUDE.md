# CLAUDE.md

## What this is

The `FlyGACA/.github` repository: the organization profile (`profile/README.md`), the default community health files
every FlyGACA repository inherits (issue and pull request templates, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
`SECURITY.md`, `SUPPORT.md`), starter workflows (`workflow-templates/`), the new-repository starter kit
(`starter-kit/`) and a draft branch ruleset (`rulesets/`).

## This repository is public

Everything here can be read by anyone. Never put in a secret, a key, a hostname or address of internal infrastructure,
a private repository's details, or anything about how a private service is configured. Write rules and templates so
they work for any FlyGACA repository, not one project.

## Commands

```bash
starter-kit/selftest.sh     # installer, hook, workflow and templates; needs bash, jq, node and python3 with PyYAML
```

## Rules

- Work on a branch. Never push to or merge into `main`, and do not open a pull request unless the owner asks.
- A change to a default community file changes every repository that inherits it. Say so in the commit message.
- The Arabic spellings of FlyGACA's names in the profile were chosen by the owner. Do not "correct" them.
- Regulatory statements cite the exact GACAR part and section, and nothing is invented (see `CONTRIBUTING.md`).
- Do not change organization or repository settings (rulesets, branch protection, Actions, secrets). Draft the config
  as a file and let the owner apply it.
- When you change `starter-kit/files/`, `starter-kit/install.sh` or `workflow-templates/`, run `starter-kit/selftest.sh`.
  Keep `starter-kit/files/.claude/hooks/guard-git.sh` in step with the copy in any repository that has customised it.
