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
const formats = cli('formats');
const stageIds = 'script set character still angle_still image_to_video talking_head tts sfx laugh_track captions edit end_card mute_test qa'.split(' ');
const gateIds = 'continuity mouth_sync caption_timing dead_air tail shot_length words_per_second mute_test orientation black_corners eyes'.split(' ');
check('format descriptors and unique IDs', () => {
  assert.equal(formats.status, 0); assert.ok(formats.value.length >= 12);
  assert.equal(new Set(formats.value.map(f => f.id)).size, formats.value.length, 'duplicate format ID');
  for (const f of formats.value) {
    for (const key of ['id', 'name', 'description', 'hookPattern']) assert.ok(typeof f[key] === 'string' && f[key].trim());
    assert.ok(f.aspectRatios.length && f.aspectRatios.every(r => ['9:16', '4:5', '16:9', '1:1'].includes(r)));
    assert.ok(f.durationSeconds.min > 0 && f.durationSeconds.max >= f.durationSeconds.min);
    assert.ok(f.stages.length && f.stages.every(s => stageIds.includes(s)));
    assert.equal(new Set(f.stages).size, f.stages.length);
    assert.ok(f.qaGates.length > 0, 'missing QA gates'); assert.ok(f.qaGates.every(g => gateIds.includes(g)));
    assert.ok(f.learned.length && f.sources.length && f.riskNotes.some(n => /housing special ad category/.test(n)));
    assert.ok(f.riskNotes.some(n => /No fake testimonials/.test(n)));
    assert.ok(['free', 'cheap', 'mid', 'expensive'].includes(f.costClass)); assert.ok(['low', 'medium', 'high'].includes(f.policyRisk));
    assert.deepEqual(Object.keys(f.providers), f.stages);
    for (const p of Object.values(f.providers)) {
      assert.ok(p.model && /^\d{4}-\d{2}-\d{2}$/.test(p.verified)); assert.equal(typeof p.unverified, 'boolean');
      assert.ok(Number.isFinite(p.estimatedCostUsd.low) && p.estimatedCostUsd.low >= 0);
      assert.ok(Number.isFinite(p.estimatedCostUsd.high) && p.estimatedCostUsd.high >= p.estimatedCostUsd.low && p.estimatedCostUsd.note);
    }
  }
});
check('sitcom and lo-fi lessons survive', () => {
  const sitcom = formats.value.find(f => f.id === 'sitcom'), lofi = formats.value.find(f => f.id === 'lo-fi');
  for (const term of ['mediums and close-ups', 'Cut on action', 'silent reaction', 'six of ten']) assert.ok(sitcom.learned.join(' ').includes(term));
  for (const term of ['No still frames as shots', 'native pace', '3.4', 'black corners', 'eyes']) assert.ok(lofi.learned.join(' ').includes(term));
  for (const f of [sitcom, lofi]) assert.ok(f.riskNotes.some(n => n.includes('DRAMATIZATION')));
});
for (const args of [['formats', 'show', 'missing'], ['plan', '--format', 'missing', '--site', 'demo'], ['formats', 'show'],
  ['formats', '--risk', 'bad'], ['formats', '--cost-class', 'bad'], ['plan', '--format', 'sitcom'],
  ['plan', '--format', 'sitcom', '--site', '../bad'], ['plan', '--format', 'sitcom', '--site', 'demo', '--apply'],
  ['plan', '--format', 'sitcom', '--site', 'demo', '--template', 'door-open-teaser']]) {
  check('format rejects ' + args.join(' '), () => assert.notEqual(cli(...args).status, 0));
}
check('unknown format error is clear', () => assert.match(cli('formats', 'show', 'missing').value.error, /Unknown format/));
const formatCases = [['list_formats', {}, formats.value]];
for (const costClass of ['free', 'cheap', 'mid', 'expensive']) for (const risk of ['low', 'medium', 'high']) {
  const filtered = cli('formats', '--cost-class', costClass, '--risk', risk);
  check(`format filter ${costClass}/${risk}`, () => { assert.equal(filtered.status, 0); assert.deepEqual(filtered.value, formats.value.filter(f => f.costClass === costClass && f.policyRisk === risk)); });
  formatCases.push(['list_formats', { costClass, risk }, filtered.value]);
}
for (const f of formats.value) {
  const shown = cli('formats', 'show', f.id), planned = cli('plan', '--format', f.id, '--site', 'demo');
  check('format show and dry-run ' + f.id, () => {
    assert.equal(shown.status, 0); assert.deepEqual(shown.value, f); assert.equal(planned.status, 0);
    const p = planned.value; assert.equal(p.dryRun, true); assert.equal(p.applied, false); assert.equal(p.spendUsd, 0);
    assert.deepEqual(p.stages.map(s => s.id), f.stages); assert.deepEqual(p.qaGates, f.qaGates);
    assert.equal(p.policyRisk, f.policyRisk); assert.deepEqual(p.riskNotes, f.riskNotes);
    assert.deepEqual(p.total, f.estimatedCostUsd);
    for (const key of ['low', 'high']) assert.equal(p.total[key], Math.round(p.stages.reduce((n, s) => n + s.estimatedCostUsd[key], 0) * 1000) / 1000);
    assert.deepEqual(cli('plan', '--format', f.id, '--site', 'demo', '--dry-run').value, p);
  });
  formatCases.push(['get_format', { id: f.id }, shown.value], ['plan_format', { format: f.id, site: 'demo' }, planned.value]);
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
const { listFormats, getFormat, planFormat } = await import('./src/index.js');
const before = listFormats(); const changed = getFormat('sitcom'); changed.stages.length = 0;
assert.deepEqual(listFormats(), before);
const input = Object.freeze({ format: 'sitcom', site: 'demo' });
const result = planFormat(input); result.stages[0].provider.model = 'mutated';
assert.deepEqual(listFormats(), before); assert.notDeepEqual(planFormat(input), result);
assert.throws(() => planFormat({ ...input, apply: true }));
assert.throws(() => planFormat({ ...input, dryRun: false }));
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
  check('MCP seven tools', () => assert.equal(list.result.tools.length, 7));
  for (const [name, args, expected] of [['list-templates', {}, templates.value], ['list-hooks', {}, hooks.value],
    ['lint', { copy: 'Browse listings' }, safe.value], ['plan', {}, plan.value], ...formatCases]) {
    const response = await request('tools/call', { name, arguments: args });
    check('MCP parity ' + name, () => assert.deepEqual(JSON.parse(response.result.content[0].text), expected));
  }
  for (const [name, args] of [['get_format', { id: 'missing' }], ['plan_format', { format: 'missing', site: 'demo' }],
    ['plan_format', { format: 'sitcom', site: 'demo', dryRun: false }], ['plan_format', { format: 'sitcom', site: 'demo', apply: true }]]) {
    const r = await request('tools/call', { name, arguments: args });
    check('MCP format rejects ' + JSON.stringify(args), () => { assert.equal(r.result.isError, true); if (args.id === 'missing' || args.format === 'missing') assert.match(r.result.content[0].text, /Unknown format/); });
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
    for (const file of ['LICENSE', 'README.md', 'bin/agentic-ads', 'bin/agentic-ads-mcp', 'src/hooks/library.json', 'src/formats/index.js', 'src/formats/library.json']) assert.ok(files.includes(file));
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
