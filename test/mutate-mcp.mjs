// Inject one-line faults serially and restore the server even when verification fails.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const file = 'bin/agentic-ads-mcp', original = await readFile(file, 'utf8');
const faults = [
  ['initialize gate', "else if (!initialized) { fail(id, -32002, 'Initialize first'); return; }", '', /tools\/list initialize gate/],
  ['frame limit', 'buffer.length > 65536', 'buffer.length > 1e12', /MCP frame limit/],
  ['blocked copy', "isError: value.status === 'blocked' || value.policy?.status === 'blocked'", 'isError: false', /lint blocked copy must set isError/],
  ['server exit', "else if (method === 'tools/call') {", "else if (method === 'tools/call') { process.stderr.write('forced MCP exit\\n'); process.exit(3);", /MCP server exited: code=3, signal=null; last stderr: "forced MCP exit\\n"; pending request: tools\/call \([a-z_-]+\)/],
];
const evidence = [];
const run = () => spawnSync(process.execPath, ['test/e2e.mjs'], { encoding: 'utf8', timeout: 180000 });
for (const [name, match, replacement, failure] of faults) {
  try {
    assert.equal(original.split(match).length, 2, 'mutation target must be unique');
    const changed = original.replace(match, replacement);
    assert.equal(changed.split('\n').filter((line, i) => line !== original.split('\n')[i]).length, 1);
    await writeFile(file, changed);
    const r = run(); assert.ifError(r.error); assert.equal(r.status, 1); assert.match(r.stderr, failure);
    assert.doesNotMatch(r.stderr, /MCP timeout|Detected unsettled top-level await/);
    evidence.push({ name, match, replacement, exitCode: r.status, signal: r.signal, stderr: r.stderr });
    console.log(`EXPECTED FAIL: ${name} (exit ${r.status})`);
  } finally {
    await writeFile(file, original);
    assert.equal(await readFile(file, 'utf8'), original);
    console.log(`RESTORED: ${name}`);
  }
}
const restored = run(); assert.ifError(restored.error); assert.equal(restored.status, 0, restored.stderr);
await mkdir('test/artifacts', { recursive: true });
await writeFile('test/artifacts/mcp-mutations.json', JSON.stringify({ command: 'node test/mutate-mcp.mjs', node: process.version, evidence, restored: restored.stdout.trim() }, null, 2) + '\n');
console.log(restored.stdout.trim());
console.log('Mutation evidence: test/artifacts/mcp-mutations.json');
