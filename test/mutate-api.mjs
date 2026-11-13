// Each single-line fault must fail its matching HTTP assertion.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = 'src/http.js', original = await readFile(file, 'utf8'), evidence = [];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 90000 });
const baseline = run();
if (baseline.error || baseline.status !== 0) {
  await mkdir('test/artifacts', { recursive: true });
  await writeFile('test/artifacts/api-mutations.json', JSON.stringify({ command: 'node test/mutate-api.mjs',
    completed: false, evidence, reason: 'Baseline failed; no mutations attempted', stderr: baseline.stderr }, null, 2) + '\n');
  throw new Error('Baseline E2E failed; no mutations attempted. See test/artifacts/api-mutations.json');
}
const faults = [
  ['skip token check', "if (token && !timingSafeEqual", "if (false && !timingSafeEqual", /API status \/health/],
  ['raise body limit', 'if (size > 65536)', 'if (size > 131072)', /API status \/v1\/lint/],
  ['allow apply', "if (hasApply(args)) { send(400, { error: 'Apply is unavailable' }); return; }", 'if (hasApply(args)) delete args.apply;', /API status \/v1\/plan/],
];
for (const [name, from, to, failure] of faults) {
  try {
    assert.equal(original.split(from).length, 2, 'unique mutation target');
    const changed = original.replace(from, to);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    await writeFile(file, changed);
    const result = run(); assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, failure);
    evidence.push({ name, file, exitCode: result.status, stderr: result.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${result.status})`);
  } finally { await writeFile(file, original); assert.equal(await readFile(file, 'utf8'), original); }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/api-mutations.json', JSON.stringify({
  command: 'node test/mutate-api.mjs', node: process.version, evidence, restored: restored.stdout.trim(),
}, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/api-mutations.json');
