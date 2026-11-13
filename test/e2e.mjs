import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile, readFile, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
await rm('test/artifacts/e2e.json', { force: true });
const checks = [];
function check(name, fn) { fn(); checks.push({ name, passed: true }); }
function cli(...args) {
  const p = spawnSync(process.execPath, ['bin/agentic-ads', ...args], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(p.error); assert.equal(p.stderr, '');
  return { status: p.status, value: JSON.parse(p.stdout) };
}
const templates = cli('list-templates');
check('five templates and both ratios', () => {
  assert.equal(templates.status, 0); assert.equal(templates.value.length, 5);
  for (const t of templates.value) assert.deepEqual(t.aspectRatios, ['4:5', '9:16']);
});
const hooks = cli('list-hooks');
check('hook metadata', () => {
  assert.equal(hooks.status, 0);
  for (const h of hooks.value) assert.ok(h.pattern && h.tags.length && h.risk);
});
for (const [copy, code] of [
  ['Guaranteed profit', 'deceptive'], ['Best homes', 'superlative'],
  ['50% below market', 'below_market'], ['Ages 25-40 only', 'targeting'],
  ['ZIP codes only', 'targeting'], ['Only today', 'urgency'],
  ['BREAKING update', 'news'], ['Before and after', 'staging'], ['', 'empty'],
]) {
  const r = cli('lint', '--copy', copy);
  check(`lint ${code}`, () => { assert.equal(r.status, 2); assert.ok(r.value.findings.some(f => f.code === code || f.code.startsWith(code + '_'))); });
}
const safe = cli('lint', '--copy', 'Browse listings');
check('safe copy still needs review', () => {
  assert.equal(safe.status, 0); assert.equal(safe.value.status, 'review');
  assert.ok(safe.value.findings.length);
});
check('housing category required', () => {
  const r = cli('lint', '--copy', 'Browse homes', '--category', 'none');
  assert.equal(r.status, 2); assert.ok(r.value.findings.some(f => f.code === 'housing_category'));
});
const plan = cli('plan');
check('default dry run', () => {
  assert.equal(plan.status, 0); assert.equal(plan.value.dryRun, true);
  assert.equal(plan.value.estimate.costMinor, 0); assert.equal(plan.value.applied, false);
  assert.deepEqual(cli('plan', '--dry-run').value, plan.value);
});
for (const args of [['plan', '--apply'], ['plan', '--apply', '--dry-run'], ['bad'],
  ['lint'], ['plan', '--wat'], ['lint', '--copy'], ['plan', '--site', 'a', '--site', 'b'],
  ['plan', '--ratio', '1:1'], ['plan', '--template', 'missing']]) {
  check(`reject ${args.join(' ')}`, () => assert.notEqual(cli(...args).status, 0));
}
const integration = spawnSync(process.execPath, ['--input-type=module', '-e', `
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { templates, templateProvider, guardCost, selectFor, readScores, writeScores } from './src/index.js';
const dir = await mkdtemp(join(tmpdir(), 'aae-'));
try {
  assert.deepEqual(await readScores(dir, 'demo'), {});
  await writeScores(dir, 'demo', { 'help': 8 });
  const scores = await readScores(dir, 'demo');
  assert.equal(selectFor({ id: 'demo', scores }, 'discovery').id, 'help');
  assert.equal(selectFor({ id: 'other', scores: {} }, 'discovery').id, 'door');
  await assert.rejects(readScores(dir, '../bad'));
  await assert.rejects(writeScores(dir, 'demo', { help: -1 }));
  await writeFile(join(dir, 'demo.json'), '{');
  await assert.rejects(readScores(dir, 'demo'));
  for (const t of templates) for (const ratio of t.aspectRatios) {
    const slots = Object.fromEntries(t.slots.map(s => [s.name, '<sample>']));
    const input = { template: t.id, ratio, slots, brand: { name: 'Demo', primary: '#123456' } };
    const a = templateProvider.run(input);
    assert.deepEqual(a, templateProvider.run(input));
    assert.equal(a.mime, 'text/html'); assert.equal(a.image, null);
    assert.ok(a.html.includes('&lt;sample&gt;')); assert.ok(!a.html.includes('<sample>'));
  }
  assert.throws(() => templateProvider.run({ template: 'door-open-teaser', slots: {} }));
  const base = { costMinor: 5, adSpentMinor: 5, monthSpentMinor: 95, perAdMinor: 10, perMonthMinor: 100, apply: true };
  assert.equal(guardCost(base).ok, true);
  assert.equal(guardCost({ ...base, apply: false }).ok, false);
  assert.equal(guardCost({ ...base, costMinor: 6 }).ok, false);
  assert.equal(guardCost({ ...base, adSpentMinor: 0, costMinor: 6 }).ok, false);
  for (const costMinor of [-1, 0.5, Infinity, NaN, undefined]) assert.throws(() => guardCost({ ...base, costMinor }));
  console.log('library integration passed');
} finally { await rm(dir, { recursive: true, force: true }); }
`], { encoding: 'utf8', timeout: 5000 });
check('library integration child', () => { assert.equal(integration.status, 0, integration.stderr); });
const server = spawn(process.execPath, ['bin/agentic-ads-mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = ''; server.stderr.on('data', x => { stderr += x; });
const pending = new Map(); let next = 0;
const lines = createInterface({ input: server.stdout });
lines.on('line', line => {
  const message = JSON.parse(line); const waiter = pending.get(message.id);
  assert.ok(waiter, 'unexpected response'); pending.delete(message.id); waiter(message);
});
function raw(wire, id = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP timeout')), 3000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); });
    server.stdin.write(wire + '\n');
  });
}
function request(method, params = {}) {
  const id = ++next;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MCP timeout')), 3000);
    pending.set(id, value => { clearTimeout(timer); resolve(value); });
    const wire = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    server.stdin.write(wire.slice(0, 8)); server.stdin.write(wire.slice(8));
  });
}
try {
  const init = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
  check('MCP initialize', () => assert.equal(init.result.protocolVersion, '2024-11-05'));
  server.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const list = await request('tools/list');
  check('MCP four tools', () => assert.equal(list.result.tools.length, 4));
  for (const [name, args, expected] of [['list-templates', {}, templates.value], ['list-hooks', {}, hooks.value],
    ['lint', { copy: 'Browse listings' }, safe.value], ['plan', {}, plan.value]]) {
    const response = await request('tools/call', { name, arguments: args });
    check('MCP parity ' + name, () => assert.deepEqual(JSON.parse(response.result.content[0].text), expected));
  }
  const unknown = await request('unknown');
  check('MCP method error', () => assert.equal(unknown.error.code, -32601));
  const malformed = await raw('{');
  check('MCP malformed JSON', () => assert.equal(malformed.error.code, -32700));
  const invalid = await raw('[]');
  check('MCP invalid request', () => assert.equal(invalid.error.code, -32600));
  const unknownTool = await request('tools/call', { name: 'unknown' });
  check('MCP unknown tool', () => assert.equal(unknownTool.error.code, -32602));
  assert.equal((await request('tools/call', { name: 'plan', arguments: { apply: true } })).result.isError, true);
  assert.equal((await request('tools/call', { name: 'lint', arguments: { copy: 2 } })).result.isError, true);
  const nullArgs = await request('tools/call', { name: 'plan', arguments: null });
  check('MCP rejects null arguments', () => assert.equal(nullArgs.result.isError, true));
  assert.equal(stderr, '');
} finally {
  server.stdin.end();
  const timer = setTimeout(() => server.kill(), 1000);
  await new Promise(resolve => server.once('close', resolve)); clearTimeout(timer); lines.close();
}
const packDir = await mkdtemp(join(tmpdir(), 'aae-pack-'));
try {
  const packed = spawnSync('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', packDir], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, npm_config_cache: join(packDir, 'cache') },
  });
  check('npm pack contents', () => {
    assert.equal(packed.status, 0, packed.stderr);
    const files = Object.values(JSON.parse(packed.stdout))[0].files.map(f => f.path);
    for (const file of ['LICENSE', 'README.md', 'bin/agentic-ads', 'bin/agentic-ads-mcp', 'src/hooks/library.json']) assert.ok(files.includes(file));
    assert.ok(files.every(f => !f.startsWith('test/')));
  });
  const linked = join(packDir, 'agentic-ads');
  await symlink(resolve('bin/agentic-ads'), linked);
  const linkedRun = spawnSync(linked, ['list-hooks'], { encoding: 'utf8', timeout: 5000 });
  check('linked executable', () => { assert.equal(linkedRun.status, 0); assert.deepEqual(JSON.parse(linkedRun.stdout), hooks.value); });
} finally { await rm(packDir, { recursive: true, force: true }); }
const corpus = JSON.parse(await readFile('test/policy-corpus.json', 'utf8'));
const { lint: lintCopy } = await import('../src/index.js');
check('policy corpus: honest copy is not blocked', () => {
  const wrong = corpus.honest.filter(t => lintCopy(t).status === 'blocked');
  assert.deepEqual(wrong, []);
});
check('policy corpus: flagged copy carries a targeting finding', () => {
  const missed = corpus.flagged.filter(([text, expect]) => {
    const r = lintCopy(text);
    return !r.findings.some(f => f.code.startsWith('targeting')) || (expect === 'blocked' && r.status !== 'blocked');
  }).map(x => x[0]);
  assert.deepEqual(missed, []);
});
check('policy corpus: hostile 20,000-character input stays fast', () => {
  for (const text of ['\uFDFA'.repeat(20000), '1'.repeat(19999) + 'a', '{{'.repeat(9999), 'no '.repeat(6666)]) {
    const start = process.hrtime.bigint();
    lintCopy(text);
    assert.ok(Number(process.hrtime.bigint() - start) / 1e6 < 500);
  }
});
await mkdir('test/artifacts', { recursive: true });
const artifact = { command: 'node test/e2e.mjs', node: process.version, passed: checks.length, checks };
await writeFile('test/artifacts/e2e.json', JSON.stringify(artifact, null, 2) + '\n');
console.log('PASS ' + checks.length + ' checks; test/artifacts/e2e.json');
