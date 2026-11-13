// Prove five one-line QA faults fail E2E, then restore the exact file bytes.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const evidence = [];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 60000 });
const faults = [
  ['drop R14', 'src/formats/library.json', s => s.replace(', "R14"', ''), /QA pinned rules: screen-voiceover/],
  ['rename R1', 'src/qa/rules.json', s => s.replace('"id": "R1"', '"id": "R99"'), /QA rule IDs/],
  ['empty check', 'src/qa/rules.json', s => s.replace(/"check": "[^"]*"/, '"check": ""'), /QA non-empty check: R1/],
  ['change check text', 'src/qa/rules.json', s => s.replace('"check": "Look', '"check": "Watch'), /QA rule text pinned/],
  ['soften severity', 'src/qa/rules.json', s => s.replace('"severity": "blocking"', '"severity": "advisory"'), /QA rule text pinned/],
];
for (const [name, file, mutate, failure] of faults) {
  const original = await readFile(file, 'utf8');
  try {
    const changed = mutate(original);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    JSON.parse(changed); // These faults change valid data, not JSON syntax.
    await writeFile(file, changed);
    const result = run(); assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, failure);
    evidence.push({ name, file, exitCode: result.status, stderr: result.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${result.status})`);
  } finally {
    await writeFile(file, original);
    assert.equal(await readFile(file, 'utf8'), original);
    console.log(`RESTORED: ${name}`);
  }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/qa-mutations.json', JSON.stringify({
  command: 'node test/mutate-qa.mjs', node: process.version, evidence, restored: restored.stdout.trim(),
}, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/qa-mutations.json');
