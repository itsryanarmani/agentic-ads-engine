// Compare the pinned catalog and CLI output with the owner's markdown table.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { costRatchet } from '../src/qa/index.js';

assert.ok(process.argv[2], 'Usage: node test/verify-qa-source.mjs <owner-feedback.md>');
const markdown = await readFile(process.argv[2], 'utf8');
const rows = markdown.split(/\r?\n/).filter(line => /^\| R\d+ \|/.test(line)).map(line => {
  const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
  assert.equal(cells.length, 4);
  return Object.fromEntries(['id', 'title', 'check', 'origin'].map((key, i) => [key, cells[i]]));
});
assert.deepEqual(rows.map(row => row.id), Array.from({ length: 26 }, (_, i) => `R${i + 1}`));
const cli = spawnSync(process.execPath, ['bin/agentic-ads', 'qa-rules'], { encoding: 'utf8' });
assert.ifError(cli.error);
assert.equal(cli.status, 0, cli.stderr);
const rules = JSON.parse(cli.stdout);
const pinned = JSON.parse(await readFile('test/qa-rules-expected.json', 'utf8'));
assert.deepEqual(rules, pinned);
assert.deepEqual(rules.map(({ id, title, check, origin }) => ({ id, title, check, origin })), rows);
const cost = markdown.split('## Cost ratchet (R18)')[1].split('## Reviewer checklist')[0]
  .split(/\r?\n/).filter(line => line.startsWith('- ')).map(line => line.slice(2));
assert.equal(cost.length, 6);
assert.equal(costRatchet, cost.join('\n'));
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/qa-source.json', JSON.stringify({
  command: 'node test/verify-qa-source.mjs <owner-feedback.md>',
  rows: rows.length, fields: ['id', 'title', 'check', 'origin'], costInstructions: cost.length, passed: true,
}, null, 2) + '\n');
console.log(`PASS: ${rows.length} source rows, pinned catalog, CLI output; ${cost.length} cost instructions unchanged`);
