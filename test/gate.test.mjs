import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as gate from '../scripts/gate.mjs';

const { runGate, slugify } = gate;

const NOW = new Date('2026-11-14T00:00:00Z');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flygaca-gate-'));
  return {
    root,
    write(rel, content) {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
    },
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

test('disclaimer: flags a missing Arabic non-affiliation statement', async () => {
  const f = fixture();
  try {
    f.write('README.md', '# App\n\nWe are not affiliated with GACA.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['disclaimer'],
      config: {
        disclaimer: {
          files: ['README.md'],
          english: 'not affiliated with',
          arabic: 'غير\\s+تابع|لا\\s+تتبع|غير\\s+مرتبط',
        },
      },
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0].check, 'disclaimer');
    assert.match(result.warnings[0].message, /Arabic/);
  } finally {
    f.cleanup();
  }
});

test('gacar: rejects FAA/CFR numbering', async () => {
  const f = fixture();
  try {
    f.write('guide.md', '# Guide\n\nSee 14 CFR Part 91 for the rule.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['gacar'],
      config: { gacar: { include: ['**/*.md'], maxPart: 199 } },
    });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].check, 'gacar');
    assert.match(result.errors[0].message, /14 CFR/);
    assert.equal(result.errors[0].line, 3);
  } finally {
    f.cleanup();
  }
});

test('gacar: rejects a malformed section sign', async () => {
  const f = fixture();
  try {
    f.write('guide.md', '# Guide\n\nRefer to GACAR §91 for the rule.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['gacar'],
      config: { gacar: { include: ['**/*.md'], maxPart: 199 } },
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /malformed §/);
  } finally {
    f.cleanup();
  }
});

test('gacar: rejects a GACAR part outside the published range', async () => {
  const f = fixture();
  try {
    f.write('guide.md', '# Guide\n\nGACAR Part 999 applies to this aircraft.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['gacar'],
      config: { gacar: { include: ['**/*.md'], maxPart: 199 } },
    });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Part 999 is out of range/);
  } finally {
    f.cleanup();
  }
});

test('bilingual: flags an Arabic-only document', async () => {
  const f = fixture();
  try {
    f.write('phases/03_education/README_AR.md', '# المرحلة\n\nمحتوى عربي فقط.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['bilingual'],
      config: { bilingual: { arabic: ['**/README_AR.md'], requireCounterparts: true } },
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0].message, /no English counterpart/);
    assert.match(result.warnings[0].file, /README_AR\.md$/);
  } finally {
    f.cleanup();
  }
});

test('register: flags repository rows with no Owner column', async () => {
  const f = fixture();
  try {
    f.write(
      'REPOSITORIES.md',
      [
        '# Repositories',
        '',
        '| Repository | What it covers |',
        '| --- | --- |',
        '| FlyGACA web | Regulatory reference |',
        '| C172 | Study phases |',
        '',
      ].join('\n'),
    );
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['register'],
      config: {
        register: {
          files: ['REPOSITORIES.md'],
          requiredColumns: ['Repository', 'Owner'],
        },
      },
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 2);
    assert.ok(result.warnings.every((w) => /Owner unverified/.test(w.message)));
  } finally {
    f.cleanup();
  }
});

test('links: flags a broken cross-file anchor', async () => {
  const f = fixture();
  try {
    f.write('guide.md', '# Guide\n\n[Setup](other.md#setup-guide)\n');
    f.write('other.md', '# Other\n\nNo such heading here.\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['links'],
      config: { links: { include: ['**/*.md'] } },
    });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].check, 'links');
    assert.match(result.errors[0].message, /broken anchor other\.md#setup-guide/);
  } finally {
    f.cleanup();
  }
});

test('stripTags: drops tags by scanning and keeps the surrounding text', () => {
  const { stripTags } = gate;
  assert.equal(typeof stripTags, 'function', 'scripts/gate.mjs must export stripTags');
  assert.equal(stripTags('Run <code>gate</code> locally'), 'Run gate locally');
  assert.equal(stripTags('<a id="x"></a>Setup'), 'Setup');
  // A "<" with no closing ">" is text, not a tag, and is kept as written.
  assert.equal(stripTags('Parts 1 < 199'), 'Parts 1 < 199');
  assert.equal(stripTags('a <b>c</b> <d'), 'a c <d');
});

test('slugify: strips tags without a regular expression', () => {
  // The regex form /<[^>]+>/ is flagged by CodeQL as incomplete
  // multi-character sanitization (js/incomplete-multi-character-sanitization).
  assert.doesNotMatch(slugify.toString(), /<\[\^>\]\+>/);
  assert.equal(slugify('Run <code>gate</code> locally'), 'run-gate-locally');
});

test('links: resolves an anchor whose heading contains inline HTML', async () => {
  const f = fixture();
  try {
    f.write('guide.md', '# Guide\n\n[Run](#run-gate-locally)\n\n## Run <code>gate</code> locally\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['links'],
      config: { links: { include: ['**/*.md'] } },
    });
    assert.deepEqual(result.findings, []);
  } finally {
    f.cleanup();
  }
});

test('sources: flags a stale source-verified date', async () => {
  const f = fixture();
  try {
    f.write('doc.md', '# Doc\n\nsource-verified: 2020-01-01\n');
    const result = await runGate({
      root: f.root,
      now: NOW,
      only: ['sources'],
      config: { sources: { include: ['**/*.md'], maxAgeDays: 180 } },
    });
    assert.equal(result.warnings.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].check, 'sources');
    assert.match(result.errors[0].message, /stale/);
    assert.match(result.errors[0].message, /2020-01-01/);
  } finally {
    f.cleanup();
  }
});
