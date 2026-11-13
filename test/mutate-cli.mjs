// Prove two one-line parser faults fail E2E checks, then restore the parser.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = 'bin/agentic-ads', original = await readFile(file, 'utf8'), evidence = [];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 180000 });
for (const [name, match, replacement, failure] of [
  ['drop attached value', 'else if (value !== undefined) args[key] = value;', "else if (value !== undefined) args[key] = '';", /attached copy status/],
  ['accept repeated attached option', 'Object.hasOwn(args, key)', '(value === undefined && Object.hasOwn(args, key))', /repeated option rejected/],
]) {
  try {
    const changed = original.replace(match, replacement); assert.notEqual(changed, original);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    await writeFile(file, changed);
    const r = run(); assert.ifError(r.error); assert.equal(r.status, 1); assert.match(r.stderr, failure);
    evidence.push({ name, match, replacement, exitCode: r.status, stdout: r.stdout, stderr: r.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${r.status})`);
  } finally {
    await writeFile(file, original); assert.equal(await readFile(file, 'utf8'), original);
    console.log(`RESTORED: ${name}`);
  }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/cli-mutations.json', JSON.stringify({ command: 'node test/mutate-cli.mjs', node: process.version, evidence, restored: restored.stdout.trim() }, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/cli-mutations.json');
