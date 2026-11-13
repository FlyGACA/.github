# Default-branch ruleset (draft, not applied)

`default-branch.json` is a GitHub ruleset in the format that Settings → Rules → Rulesets → New ruleset → Import a
ruleset accepts. Nothing in this repository applies it: it ships with `"enforcement": "disabled"`, so importing it
changes nothing until someone with admin rights switches it to active.

## What it does once active

- The default branch cannot be deleted or force-pushed.
- Every change reaches it through a pull request, with review threads resolved. This is the server-side half of the
  rule in the starter kit's `CLAUDE.md` ("never push to or merge into the default branch"); the hook in
  `starter-kit/files/.claude/hooks/guard-git.sh` is only a guard rail for slips, because it sees the text of a command
  and nothing else.
- `bypass_actors` is empty, so nobody, including admins, can push straight to the branch. Add a bypass actor if you
  want an emergency route.

## Two deliberate choices

- **Zero required approvals.** In a one-person repository, or where pull requests are opened from the owner's own
  account, nobody else can approve, so a required approval would block every merge. Raise
  `required_approving_review_count` when a second reviewer exists.
- **No required status checks.** A required check that never runs blocks every merge. Once a repository's CI has run
  green, add this to `rules` and import again. The starter workflow templates name their job `test` so that this
  matches:

  ```json
  {
    "type": "required_status_checks",
    "parameters": {
      "strict_required_status_checks_policy": false,
      "do_not_enforce_on_create": false,
      "required_status_checks": [{ "context": "test" }]
    }
  }
  ```

## Applying it to one repository, or to the organization

For one repository, import the file under that repository's Settings → Rules → Rulesets. For the whole organization,
organization rulesets go under the organization's Settings; whether your plan includes them is for GitHub's pricing page
to say, and an organization ruleset also needs a repository condition, for example
`"repository_name": { "include": ["~ALL"], "exclude": [] }` next to `ref_name`. I could not test an import from here
(rulesets are settings, and settings are the owner's to change), so check the preview GitHub shows before you save.
