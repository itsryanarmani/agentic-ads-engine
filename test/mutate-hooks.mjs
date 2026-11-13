// Each fault changes one catalog line. Always restore the original bytes.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = 'src/hooks/library.json';
const faults = [
  ['unsafe marked safe', /("id":"slick-agent"[^\n]*"housingSafe":)false/, '$1true', /housing-safe hook fails lint: slick-agent/],
  ['missing format', '"formats":["pov","lo-fi"]', '"formats":["missing-format","lo-fi"]', /unknown hook format/],
  ['duplicate ID', '"id":"compare"', '"id":"door"', /duplicate hook ID/],
];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 900000 });
const evidence = [];
for (const [name, match, replacement, failure] of faults) {
  const original = await readFile(file, 'utf8');
  try {
    const changed = original.replace(match, replacement);
    assert.notEqual(changed, original);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    await writeFile(file, changed);
    const result = run(); assert.ifError(result.error);
    assert.equal(result.status, 1); assert.match(result.stderr, failure);
    evidence.push({ name, file, match: String(match), replacement, exitCode: result.status, stdout: result.stdout, stderr: result.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${result.status})`);
  } finally {
    await writeFile(file, original); assert.equal(await readFile(file, 'utf8'), original);
    console.log(`RESTORED: ${name}`);
  }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/hooks-mutations.json', JSON.stringify({ command: 'node test/mutate-hooks.mjs', node: process.version, evidence, restored: restored.stdout.trim() }, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/hooks-mutations.json');
