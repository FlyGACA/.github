export const meta = {
  name: 'review-change',
  description: 'Review the current change in five dimensions, then have a skeptic try to refute every finding',
  whenToUse: 'Before opening or updating a pull request. Read-only: it never edits, builds, commits or pushes.',
  phases: [
    { title: 'Review', detail: 'one reviewer per dimension reads the change' },
    { title: 'Verify', detail: 'a skeptic tries to refute each finding' },
  ],
}

// args (optional): { base: 'origin/main' } - the branch the change will be merged into.
// Adapt DIMENSIONS to the project: add the things that have gone wrong here before, and drop what does not apply.
const BASE = (args && args.base) || 'origin/main'

const FINDINGS = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          summary: { type: 'string', description: 'One sentence: what is wrong.' },
          scenario: { type: 'string', description: 'A concrete input or state, and the wrong outcome it produces.' },
        },
        required: ['file', 'summary', 'scenario'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    evidence: { type: 'string', description: 'What you read or ran, and what it showed.' },
  },
  required: ['real', 'evidence'],
}

const COMMON = [
  'You are reviewing one change to a FlyGACA repository.',
  'Read only: do not edit files, commit, push or rebuild anything.',
  `The change is what differs from ${BASE}: run \`git diff $(git merge-base HEAD ${BASE})\` and \`git status\`, and read the changed files`,
  'in full where the diff is not enough. CLAUDE.md and the files in .claude/rules/ say how this project works; read the ones that apply.',
  'Report only problems in code or text this change adds or modifies, each with a concrete scenario. Do not report style preferences.',
  'If you find nothing, return an empty list: that is a good answer, not a failure.',
].join('\n')

const DIMENSIONS = [
  {
    key: 'correctness',
    focus: 'Correctness. Logic errors, unhandled cases, wrong assumptions about inputs, state that can go stale, error paths that lose or hide a failure.',
  },
  {
    key: 'security',
    focus: 'Security and privacy. Secrets or personal data committed, logged or sent to a third party; input that reaches a file path, a query or a command unchecked; access decided by something the caller controls; anything that fails open.',
  },
  {
    key: 'aviation-content',
    focus: 'Aviation and regulatory content. Every regulatory statement must cite the exact GACAR part and section; no invented section numbers, limits or figures; educational material must not read as operational data; FlyGACA must not read as an official or government source.',
  },
  {
    key: 'bilingual',
    focus: 'English and Arabic. Text present in one language and missing in the other; versions that say different things; Arabic wording that is new and not flagged for native review; layout that would not mirror in right-to-left; Latin text or numbers that would break up Arabic text.',
  },
  {
    key: 'tests',
    focus: 'Tests and claims. Could each new or changed test fail if the code were wrong (vacuous assertions, checks that pass trivially)? Are the cases this change introduces covered, including the failure and empty cases? Does the pull request text or a commit message claim something no test or command shows?',
  },
]

const verifyPrompt = (f, d) => [
  `A reviewer reports this problem in a FlyGACA repository (dimension: ${d.key}).`,
  `File: ${f.file}${f.line ? ':' + f.line : ''}`,
  `Problem: ${f.summary}`,
  `Scenario: ${f.scenario}`,
  'Try to REFUTE it. Read the code or text at that location, follow the scenario step by step, and use read-only commands where that helps.',
  'Answer real=true only if you can show the scenario happening here. If it is already prevented, or you cannot reproduce it, answer real=false. When uncertain, answer real=false.',
  'Do not edit, build, commit or push.',
].join('\n')

phase('Review')
const results = await pipeline(
  DIMENSIONS,
  (d) => agent(
    `${COMMON}\n\nYour dimension: ${d.key}.\n\n${d.focus}`,
    { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS },
  ),
  // A reviewer that returned nothing (skipped, or failed) stays null, so it is counted below as not covered
  // instead of being mistaken for a review that found no problems.
  (review, d) => review && parallel(review.findings.map((f) => () =>
    agent(verifyPrompt(f, d), { label: `verify:${d.key}:${f.file}`, phase: 'Verify', schema: VERDICT })
      .then((verdict) => ({ dimension: d.key, ...f, verdict })))),
)

const reviewed = results.filter(Boolean).length
if (reviewed < DIMENSIONS.length) log(`${DIMENSIONS.length - reviewed} reviewer(s) returned nothing (skipped or failed): that dimension was not covered`)
const all = results.filter(Boolean).flat().filter(Boolean)
const confirmed = all.filter((f) => f.verdict && f.verdict.real)
const rejected = all.filter((f) => !(f.verdict && f.verdict.real))
log(`${confirmed.length} confirmed, ${rejected.length} refuted or unverified`)
return { base: BASE, confirmed, rejected }
