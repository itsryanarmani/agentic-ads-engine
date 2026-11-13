// Run deliberate one-line faults serially; restore each file even when an assertion fails.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const catalog = 'src/formats/library.json', planner = 'src/formats/index.js';
const faults = [
  ['missing QA gates', catalog, /"qaGates": \[[^\n]+\]/, '"qaGates": []', /missing QA gates/],
  ['duplicate format ID', catalog, '"id": "text-broll"', '"id": "screen-voiceover"', /duplicate format ID/],
  ['plan applies', planner, 'dryRun: true, applied: false', 'dryRun: false, applied: true', /false !== true/],
];
const evidence = [];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 60000 });
for (const [name, file, match, replacement, failure] of faults) {
  const original = await readFile(file, 'utf8');
  try {
    const changed = original.replace(match, replacement); assert.notEqual(changed, original);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    await writeFile(file, changed);
    const r = run(); assert.ifError(r.error); assert.equal(r.status, 1); assert.match(r.stderr, failure);
    evidence.push({ name, file, match: String(match), replacement, exitCode: r.status, stdout: r.stdout, stderr: r.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${r.status})`);
  } finally { await writeFile(file, original); }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/formats-mutations.json', JSON.stringify({ command: 'node test/mutate-formats.mjs', node: process.version, evidence, restored: restored.stdout.trim() }, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/formats-mutations.json');
