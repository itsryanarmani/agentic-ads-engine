// Run from the repository root. Each mutation changes one line and is restored.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = 'src/policy/index.js';
const original = await readFile(file, 'utf8');
await mkdir('test/artifacts', { recursive: true });
const results = [];
try {
  for (const [name, prefix, before, after, missed] of [
    ['age', 'const ageRange =', 'age[sd]?', 'ages?', 'aged 25-40'],
    ['zip', 'const postalTerm =', '|postcodes?', '', 'postcodes only'],
  ]) {
    const line = original.split('\n').find(s => s.startsWith(prefix));
    assert.ok(line?.includes(before), `mutation target missing: ${name}`);
    const changed = line.replace(before, after);
    await writeFile(file, original.replace(line, changed));
    const run = spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 120000 });
    assert.ifError(run.error);
    const output = run.stdout + run.stderr;
    await writeFile(`test/artifacts/mutation-${name}.log`, output);
    assert.equal(run.status, 1, `${name} mutation must fail`);
    assert.ok(output.includes(missed), `${name} must fail on its new corpus case`);
    results.push({ name, before: line, after: changed, exitCode: run.status, missed });
    await writeFile(file, original);
  }
} finally {
  await writeFile(file, original);
}
const restored = spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 120000 });
assert.ifError(restored.error);
assert.equal(restored.status, 0, restored.stdout + restored.stderr);
assert.equal(await readFile(file, 'utf8'), original);
await writeFile('test/artifacts/policy-mutations.json', JSON.stringify({
  command: 'node test/prove-policy-mutations.mjs', node: process.version,
  results, restored: true, final: restored.stdout.trim(),
}, null, 2) + '\n');
console.log('PASS two one-line mutations fail; source restored');
process.stdout.write(restored.stdout);
