// Workflow policy: least privilege and immutable refs are checked in text, like the gate's rules.
// The AI review runs over untrusted pull-request content, so the job that holds the model key must
// not also hold a write token, and nothing here may run a mutable action tag.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const GATE = read('.github/workflows/qoder-gate.yml');
const STARTER = read('.github/workflows/starter-kit.yml');
const TEMPLATES = ['workflow-templates/node-ci.yml', 'workflow-templates/python-ci.yml'].map(read);

/** Top-level YAML block (before `jobs:`) or one 2-space job block. */
function section(text, name) {
  const lines = text.split('\n');
  if (name === null) {
    const end = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    return lines.slice(0, end === -1 ? lines.length : end).join('\n');
  }
  const start = lines.findIndex((l) => new RegExp(`^  ${name}:\\s*$`).test(l));
  assert.notEqual(start, -1, `job "${name}" not found`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^ {2}\S/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

test('every action ref is a full commit SHA with its tag in a comment', () => {
  for (const [file, text] of [['qoder-gate.yml', GATE], ['starter-kit.yml', STARTER],
    ...TEMPLATES.map((t, i) => [`template ${i}`, t])]) {
    for (const line of text.split('\n').filter((l) => /\buses:\s+\S+@/.test(l))) {
      const ref = line.match(/uses:\s+\S+@(\S+)/)[1].split(/\s/)[0];
      assert.match(ref, /^[0-9a-f]{40}$/, `${file}: mutable ref ${line.trim()}`);
      assert.match(line, /#\s*v\d+/, `${file}: pinned ref without a version comment: ${line.trim()}`);
    }
  }
});

test('no workflow-wide write permission in the content gate', () => {
  const header = section(GATE, null);
  assert.doesNotMatch(header, /:\s*write\b/, 'permissions must be granted per job, not workflow-wide');
  assert.match(header, /permissions:\s*\n\s+contents:\s*read/);
});

test('the gate and link jobs hold no more than they need', () => {
  const gate = section(GATE, 'gate');
  assert.match(gate, /contents:\s*read/);
  assert.match(gate, /security-events:\s*write/, 'SARIF upload needs security-events: write');
  assert.doesNotMatch(gate, /(contents|pull-requests|actions):\s*write/, 'the gate must not hold another write');

  const links = section(GATE, 'external-links');
  assert.match(links, /contents:\s*read/);
  assert.doesNotMatch(links, /:\s*write\b/, 'the link job must not hold a write permission');
});

test('the model runs without a write token; a separate job posts the comment', () => {
  const review = section(GATE, 'qoder-review');
  assert.doesNotMatch(review, /GH_TOKEN|GITHUB_TOKEN/, 'the model job must not receive a GitHub token');
  assert.doesNotMatch(review, /:\s*write\b/, 'the model job must not hold a write permission');
  assert.match(review, /--permission-mode\s+plan\b/, 'the model must run read-only');

  const comment = section(GATE, 'qoder-comment');
  assert.match(comment, /pull-requests:\s*write/, 'posting needs pull-requests: write');
  assert.doesNotMatch(comment, /QODER_API_KEY/, 'the posting job must not receive the model key');
  assert.match(section(GATE, 'qoder-comment'), /needs:\s*.*qoder-review/);
});

test('gate jobs are bounded and serialized', () => {
  const header = section(GATE, null);
  assert.match(header, /^concurrency:/m, 'workflow needs a concurrency group');
  for (const job of ['gate', 'external-links', 'qoder-review', 'qoder-comment']) {
    assert.match(section(GATE, job), /timeout-minutes:\s*\d+/, `${job} needs timeout-minutes`);
  }
  assert.match(section(GATE, 'qoder-review'), /concurrency:/, 'review runs for one PR must not overlap');
  assert.match(STARTER, /timeout-minutes:\s*\d+/);
});

test('dependabot keeps the pins current', () => {
  const config = read('.github/dependabot.yml');
  assert.match(config, /package-ecosystem:\s*github-actions/);
});
