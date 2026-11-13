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
const qa = cli('qa-rules');
const qaExpected = JSON.parse(await readFile('test/qa-expectations.json', 'utf8'));
const pinnedQa = JSON.parse(await readFile('test/qa-rules-expected.json', 'utf8'));
const costExpected = [
  'Set a hard cap before you spend. One writer per spend log.',
  'Reuse faces, sets, stills, clips and voice ids from earlier videos first.',
  'Pick one lip-sync model for a format and keep it. Do not repeat a bake-off.',
  'Do not make the same still twice. Do not pay for an unused line.',
  'Write `COST_NOTES.md`. Show cost per stage and against the last video of the format.',
  'A video that costs more than the last one of its format needs a one-line reason.',
].join('\n');
check('QA rule catalog', () => {
  assert.equal(qa.status, 0);
  assert.deepEqual(qa.value.map(r => r.id), Array.from({ length: 26 }, (_, i) => `R${i + 1}`), 'QA rule IDs');
  for (const r of qa.value) {
    for (const key of ['title', 'check', 'origin', 'severity']) assert.ok(typeof r[key] === 'string' && r[key].trim(), `QA non-empty ${key}: ${r.id}`);
    assert.ok(r.applies.length && r.applies.every(k => typeof k === 'string' && k.trim()));
  }
});
check('QA rule text pinned to the skills table', () => {
  assert.equal(qa.status, 0);
  assert.deepEqual(qa.value, pinnedQa, 'QA rule text pinned'); // source: ad-lofi-ugc/references/owner-feedback.md
  assert.ok(pinnedQa.every(r => r.severity === 'blocking'));
});
check('QA pinned formats', () => {
  assert.deepEqual(formats.value.map(f => f.id), qaExpected.map(f => f.id));
  for (const f of formats.value) {
    const expected = qaExpected.find(e => e.id === f.id);
    assert.deepEqual(f.kinds, expected.kinds);
    assert.deepEqual(f.feedbackRules, expected.feedbackRules, `QA pinned rules: ${f.id}`);
    assert.equal(new Set(f.feedbackRules).size, f.feedbackRules.length);
    assert.ok(f.feedbackRules.every(id => qa.value.some(r => r.id === id)), 'QA unknown reference');
    const required = ['R1', 'R6', 'R14', 'R17', 'R18', 'R19',
      ...(f.stages.includes('captions') ? ['R10', 'R23'] : []),
      ...(f.kinds.includes('dialogue') ? ['R11', 'R13', 'R21', 'R22'] : []),
      ...(f.kinds.includes('story') ? ['R2', 'R5', 'R9'] : [])];
    if (f.kinds.some(k => ['story', 'character'].includes(k))) required.push('R20', 'R26');
    for (const r of qa.value.filter(r => r.applies.some(k => k === 'all' || f.kinds.includes(k)))) required.push(r.id);
    for (const id of required) assert.ok(f.feedbackRules.includes(id), `QA required ${id}: ${f.id}`);
  }
});
const qaCases = [['list_qa_rules', {}, qa.value]];
for (const rule of qa.value) {
  const shown = cli('qa-rules', 'show', rule.id);
  check('QA show ' + rule.id, () => { assert.equal(shown.status, 0); assert.deepEqual(shown.value, rule); });
  qaCases.push(['get_qa_rule', { id: rule.id }, rule]);
}
check('QA unknown ID', () => {
  const r = cli('qa-rules', 'show', 'missing');
  assert.equal(r.status, 1); assert.match(r.value.error, /Unknown QA rule: missing.*qa-rules/);
  assert.equal(cli('qa-rules', 'show').status, 1);
});
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
const expectations = JSON.parse(await readFile('test/format-expectations.json', 'utf8'));
check('pinned format contracts', () => {
  assert.deepEqual(formats.value.map(f => f.id).sort(), expectations.map(f => f.id).sort());
  for (const expected of expectations) {
    const f = formats.value.find(f => f.id === expected.id);
    for (const key of ['costClass', 'policyRisk']) assert.equal(f[key], expected[key], `${f.id} ${key}`);
    assert.deepEqual([...f.qaGates].sort(), [...expected.qaGates].sort(), `${f.id} qaGates`);
    for (const word of expected.riskKeywords) assert.ok(f.riskNotes.join(' ').toLowerCase().includes(word), `${f.id} missing ${word}`);
  }
});
check('logged endpoint prices', () => {
  for (const f of formats.value) for (const [stage, p] of Object.entries(f.providers)) {
    const expected = { still: [0.02, 0.06], angle_still: [0.056, 0.196], tts: [0.03, f.id === 'lo-fi' ? 0.08 : 0.055], image_to_video: [0.15, 0.3], talking_head: [1.5, 1.8] }[stage];
    if (!p.estimatedCostUsd.high) { assert.equal(p.unverified, true); continue; }
    assert.deepEqual([p.estimatedCostUsd.low, p.estimatedCostUsd.high], f.id === 'text-broll' ? [0, 0.02] : expected);
    const model = { still: 'bytedance/seedream-v5.5', angle_still: 'bytedance/seedream-v5.5/edit', tts: 'wavespeed-ai/qwen3-tts/' + (f.id === 'lo-fi' ? 'voice-design' : 'text-to-speech'), image_to_video: 'wavespeed-ai/wan-2.2/i2v-480p-ultra-fast', talking_head: 'wavespeed-ai/wan-2.2/speech-to-video' }[stage];
    assert.equal(p.model, model); assert.match(p.estimatedCostUsd.note, /spend.json/);
  }
});
check('sitcom and lo-fi lessons survive', () => {
  const sitcom = formats.value.find(f => f.id === 'sitcom'), lofi = formats.value.find(f => f.id === 'lo-fi');
  for (const term of ['mediums and close-ups', 'Cut on action', 'silent reaction', 'six of ten']) assert.ok(sitcom.learned.join(' ').includes(term));
  for (const term of ['No still frames as shots', 'native pace', '3.4']) assert.ok(lofi.learned.join(' ').includes(term));
  for (const f of [sitcom, lofi]) assert.ok(f.riskNotes.some(n => n.includes('DRAMATIZATION')));
});
for (const args of [['formats', 'show', 'missing'], ['plan', '--format', 'missing', '--site', 'demo'], ['formats', 'show'],
  ['formats', '--costClass', 'mid'], ['formats', '--risk', 'bad'], ['formats', '--cost-class', 'bad'], ['plan', '--format', 'sitcom'],
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
    assert.deepEqual(p.reviewChecklist, f.feedbackRules.map(id => {
      const { title, check } = qa.value.find(r => r.id === id);
      return { id, title, check, status: 'NOT CHECKED' };
    }));
    assert.equal(p.costRatchet, costExpected);
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
const hookCases = [['list_hooks', {}, hooks.value]];
const hookExpected = JSON.parse(await readFile('test/hook-expectations.json', 'utf8'));
check('hook catalog schema and references', () => {
  assert.deepEqual(cli('hooks'), hooks);
  assert.deepEqual(cli('hooks', 'list'), hooks, 'hooks list');
  assert.ok(hooks.value.length >= 40, 'at least 40 hooks');
  assert.equal(new Set(hooks.value.map(h => h.id)).size, hooks.value.length, 'duplicate hook ID');
  for (const h of hooks.value) {
    for (const key of ['id', 'pattern', 'note']) assert.ok(typeof h[key] === 'string' && h[key].trim());
    assert.match(h.id, /^[a-z][a-z0-9-]*$/); assert.ok(!h.note.includes('\n'));
    assert.ok(h.tags.length && h.tags.every(t => typeof t === 'string' && t.trim()));
    assert.ok(h.formats.length && h.formats.every(id => formats.value.some(f => f.id === id)), 'unknown hook format');
    assert.ok(['spoken line', 'first-frame visual', 'caption', 'sound'].includes(h.kind));
    assert.ok(['shock', 'fear', 'curiosity', 'relief', 'humor', 'pride'].includes(h.emotion));
    assert.ok(['low', 'medium', 'high'].includes(h.risk)); assert.equal(typeof h.housingSafe, 'boolean');
    assert.match(h.pattern, /{{subject}}/);
  }
});
for (const h of hooks.value) {
  check('hook show ' + h.id, () => assert.deepEqual(cli('hooks', 'show', h.id), { status: 0, value: h }));
  hookCases.push(['get_hook', { id: h.id }, h]);
  if (h.housingSafe) check('housing-safe lint ' + h.id, () => {
    const filled = h.pattern.replace(/{{[a-z_]+}}/g, 'available listings');
    const result = cli('lint', '--copy', filled, '--category', 'housing');
    assert.equal(result.status, 0, 'housing-safe hook fails lint: ' + h.id);
    assert.deepEqual(result.value.findings.map(f => f.code), ['human_review']);
  });
}
check('hook safety flags pinned', () => {
  assert.deepEqual(hooks.value.map(({ id, housingSafe }) => ({ id, housingSafe })), hookExpected, 'hook safety flags pinned');
});
check('owner hook beats retained', () => {
  for (const [id, text] of [['shocked-face', /shocked face.*next.*cause/], ['all-savings', /I spent all my savings on this house/],
    ['slick-agent', /slick agent.*broke my trust/], ['someone-lives-there', /someone lives there/],
    ['scare-beat', /suspense hit/], ['street-interview', /Street interview/]]) {
    assert.match(hooks.value.find(h => h.id === id)?.pattern ?? '', text);
  }
});
for (const f of formats.value) for (const emotion of [undefined, 'shock', 'fear', 'curiosity', 'relief', 'humor', 'pride']) {
  for (const housing of [false, true]) {
    const args = { format: f.id, ...(emotion ? { emotion } : {}), housing };
    const flags = ['--format', f.id, ...(emotion ? ['--emotion', emotion] : []), '--housing=' + housing];
    const picked = cli('hooks', 'pick', ...flags);
    check('hook filters ' + JSON.stringify(args), () => {
      assert.equal(picked.status, 0);
      assert.deepEqual(picked.value, hooks.value.filter(h => h.formats.includes(f.id) &&
        (!emotion || h.emotion === emotion) && (!housing || h.housingSafe)));
      assert.deepEqual(cli('hooks', ...flags), picked);
    });
    hookCases.push(['pick_hooks', args, picked.value], ['list_hooks', args, picked.value]);
  }
}
const hookErrors = [
  ['get_hook', {}, ['hooks', 'show']], ['get_hook', { id: 'missing' }, ['hooks', 'show', 'missing']],
  ['pick_hooks', {}, ['hooks', 'pick']], ['pick_hooks', { format: 'missing' }, ['hooks', 'pick', '--format', 'missing']],
  ['pick_hooks', { format: 'pov', emotion: 'bad' }, ['hooks', 'pick', '--format', 'pov', '--emotion', 'bad']],
];
for (const [, , argv] of hookErrors) check('hook rejects ' + argv.join(' '), () => assert.equal(cli(...argv).status, 1));

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
const attachedLintCases = [];
for (const [copy, status, code] of [['--Sale--', 0], ['--best', 2, 'superlative'], ['a=b', 0], ['', 2, 'empty']]) {
  const result = cli('lint', `--copy=${copy}`, '--category=housing');
  check(`attached lint ${JSON.stringify(copy)}`, () => {
    assert.equal(result.status, status, 'attached copy status');
    if (code) assert.ok(result.value.findings.some(f => f.code === code));
    const planned = cli('plan', `--copy=${copy}`);
    assert.equal(planned.status, status); assert.equal(planned.value.copy, copy, 'attached copy preserved');
    assert.deepEqual(result.value, planned.value.policy);
  });
  attachedLintCases.push(['lint', { copy, category: 'housing' }, result.value]);
}
for (const options of [['--copy=a', '--copy=b'], ['--copy', 'a', '--copy=b'], ['--copy=a', '--copy', 'b'], ['--copy', 'a', '--copy', 'b']]) {
  check('repeated copy ' + options.join(' '), () => {
    const r = cli('lint', ...options);
    assert.equal(r.status, 1, 'repeated option rejected'); assert.equal(r.value.error, 'Unknown or repeated option');
  });
}
for (const options of [['--copy'], ['--copy', '--Sale'], ['--copy', '--category=housing']]) {
  check('missing copy ' + options.join(' '), () => {
    const r = cli('lint', ...options); assert.equal(r.status, 1);
    assert.equal(r.value.error, 'Missing option value (use --copy=VALUE for a value that starts with --)');
  });
}
for (const [action, flag] of [['plan', '--dryRun'], ['formats', '--costClass']]) for (const suffix of ['', '=true']) {
  check('removed alias ' + flag + suffix, () => {
    const r = cli(action, flag + suffix); assert.equal(r.status, 1); assert.equal(r.value.error, 'Unknown or repeated option');
  });
}
for (const [action, options] of [
  ['lint', ['--copy', 'Browse listings', '--category', 'housing']],
  ['plan', ['--site', 'demo', '--goal', 'discovery', '--template', 'door-open-teaser', '--ratio', '4:5', '--copy', 'Browse listings', '--category', 'housing']],
  ['plan', ['--format', 'sitcom', '--site', 'demo', '--goal', 'discovery']],
  ['formats', ['--cost-class', 'cheap', '--risk', 'medium']], ['get_format', ['--id', 'sitcom']],
]) {
  check('attached normal options ' + action + options[0], () => {
    const normal = cli(action, ...options); assert.equal(normal.status, 0);
    assert.deepEqual(cli(action, ...options.filter((_, i) => i % 2 === 0).map((flag, i) => `${flag}=${options[i * 2 + 1]}`)), normal);
  });
}
check('attached booleans and invalid values', () => {
  assert.deepEqual(cli('plan', '--dry-run=true'), cli('plan', '--dry-run'));
  for (const flag of ['--dry-run=false', '--dry-run=', '--dry-run=anything', '--apply=true', '--apply=false', '--category=bad', '--wat=x']) assert.equal(cli('plan', flag).status, 1);
  assert.equal(cli('plan', '--dry-run', '--dry-run=true').status, 1);
});
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
const { listRules, getRule, checklistFor } = await import('./src/qa/index.js');
const rulesBefore = listRules(); const changedRule = getRule('R1'); changedRule.applies.length = 0;
const changedRules = listRules(); changedRules[0].check = 'changed';
assert.deepEqual(listRules(), rulesBefore);
assert.throws(() => getRule('missing'), /Unknown QA rule/);
assert.throws(() => checklistFor({ feedbackRules: ['missing'] }), /Unknown QA rule/);
const before = listFormats();
assert.deepEqual(checklistFor(getFormat('sitcom')), planFormat({ format: 'sitcom', site: 'demo' }).reviewChecklist); const changed = getFormat('sitcom'); changed.stages.length = 0;
assert.deepEqual(listFormats(), before);
const input = Object.freeze({ format: 'sitcom', site: 'demo' });
const result = planFormat(input); result.stages[0].provider.model = 'mutated';
assert.deepEqual(listFormats(), before); assert.notDeepEqual(planFormat(input), result);
assert.throws(() => planFormat({ ...input, apply: true }));
assert.throws(() => planFormat({ ...input, dryRun: false }));
const { pickHooks, listHooks, getHook, hooks: catalog } = await import('./src/index.js');
const filter = { format: 'pov', emotion: 'curiosity', housing: true };
const ranked = pickHooks(filter, { 'look-again': 9, 'slick-agent': 99 });
assert.equal(ranked[0].id, 'look-again');
assert.equal(selectFor({ id: 'demo', scores: { 'look-again': 9, help: 99 } }, 'discovery', filter).id, 'look-again');
assert.equal(selectFor({ id: 'demo' }, 'missing', filter), null);
assert.deepEqual(pickHooks({ format: 'screen-voiceover', emotion: 'shock' }), []);
assert.equal(selectFor({ id: 'demo' }, 'discovery', { format: 'screen-voiceover', emotion: 'shock' }), null);
assert.deepEqual(pickHooks(filter), listHooks(filter));
ranked[0].formats.length = 0; getHook('door').tags.length = 0;
assert.ok(pickHooks(filter).every(h => h.formats.includes('pov')));
assert.ok(getHook('door').tags.length); assert.ok(Object.isFrozen(catalog[0].formats));
for (const bad of [null, [], { format: 'missing' }, { emotion: 'bad' }, { housing: 'true' }, { wat: true }]) assert.throws(() => listHooks(bad));
assert.throws(() => pickHooks(filter, { door: -1 }));
assert.throws(() => pickHooks(filter, { missing: 1 }));
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
let stderr = ''; server.stderr.on('data', x => { stderr = (stderr + x).slice(-4096); });
const pending = new Map(); let next = 0, stopped = false, serverFailure;
function failPending(cause) {
  serverFailure = cause;
  for (const waiter of pending.values()) waiter.reject(new Error(`${cause}; pending request: ${waiter.name}`));
}
const closed = new Promise(resolve => server.once('close', (code, signal) => {
  stopped = true;
  failPending(`MCP server exited: code=${code}, signal=${signal}; last stderr: ${JSON.stringify(stderr)}`);
  resolve();
}));
server.on('error', error => failPending(`MCP server error: ${error.message}; last stderr: ${JSON.stringify(stderr)}`));
// A closed pipe can emit EPIPE before close supplies the exit code and final stderr.
server.stdin.on('error', () => {});
const lines = createInterface({ input: server.stdout });
lines.on('line', line => {
  const message = JSON.parse(line); const waiter = pending.get(message.id);
  assert.ok(waiter, 'unexpected response'); waiter.resolve(message);
});
function raw(wire, id = null, name = 'raw frame') {
  return new Promise((resolve, reject) => {
    if (serverFailure) { reject(new Error(`${serverFailure}; pending request: ${name}`)); return; }
    const finish = fn => value => { clearTimeout(timer); pending.delete(id); fn(value); };
    const timer = setTimeout(() => pending.get(id).reject(new Error(`MCP timeout: ${name}`)), 3000);
    pending.set(id, { name, resolve: finish(resolve), reject: finish(reject) });
    server.stdin.write(wire.slice(0, 8)); server.stdin.write(wire.slice(8) + '\n');
  });
}
function request(method, params = {}) {
  const id = ++next;
  return raw(JSON.stringify({ jsonrpc: '2.0', id, method, params }), id,
    method + (params.name ? ` (${params.name})` : ''));
}
try {
  for (const method of ['tools/list', 'tools/call']) {
    const r = await request(method, method === 'tools/call' ? { name: 'list-templates' } : {});
    check('MCP initialize gate ' + method, () => assert.equal(r.error?.code, -32002, `${method} initialize gate`));
  }
  const init = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
  check('MCP initialize', () => assert.equal(init.result.protocolVersion, '2024-11-05'));
  server.stdin.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
  const list = await request('tools/list');
  check('MCP twelve tools', () => assert.equal(list.result.tools.length, 12));
  for (const [name, args, argv] of hookErrors) {
    const r = await request('tools/call', { name, arguments: args });
    check('MCP hook error ' + JSON.stringify(args) + name, () => {
      assert.equal(r.result.isError, true); assert.equal(r.result.content[0].text, cli(...argv).value.error);
    });
  }
  for (const [name, args, expected] of [['list-templates', {}, templates.value], ['list-hooks', {}, hooks.value],
    ['lint', { copy: 'Browse listings' }, safe.value], ['plan', {}, plan.value], ...hookCases, ...qaCases, ...formatCases, ...attachedLintCases]) {
    const response = await request('tools/call', { name, arguments: args });
    check('MCP parity ' + name, () => assert.deepEqual(JSON.parse(response.result.content[0].text), expected));
  }
  for (const [name, args] of [['get_format', { id: 'missing' }], ['plan_format', { format: 'missing', site: 'demo' }],
    ['plan_format', { format: 'sitcom', site: 'demo', dryRun: false }], ['plan_format', { format: 'sitcom', site: 'demo', apply: true }]]) {
    const r = await request('tools/call', { name, arguments: args });
    check('MCP format rejects ' + JSON.stringify(args), () => { assert.equal(r.result.isError, true); if (args.id === 'missing' || args.format === 'missing') assert.match(r.result.content[0].text, /Unknown format/); });
  }
  for (const [name, args, argv] of [
    ['get_qa_rule', {}, ['qa-rules', 'show']],
    ['get_format', {}, ['formats', 'show']], ['plan_format', { format: 'sitcom' }, ['plan', '--format', 'sitcom']],
    ['plan_format', { format: 'sitcom', site: 'demo', apply: true }, ['plan', '--format', 'sitcom', '--site', 'demo', '--apply']],
    ['plan', { apply: true }, ['plan', '--apply']]]) {
    const r = await request('tools/call', { name, arguments: args });
    check('MCP error parity ' + name + JSON.stringify(args), () => {
      assert.equal(r.result.isError, true); assert.equal(r.result.content[0].text, cli(...argv).value.error);
      assert.match(r.result.content[0].text, args.apply ? /Apply is unavailable/ : /Missing required argument/);
    });
  }
  for (const name of ['lint', 'plan']) {
    const copy = 'Guaranteed profit', expected = cli(name, '--copy', copy);
    const r = await request('tools/call', { name, arguments: { copy } });
    check('MCP blocked copy ' + name, () => {
      assert.equal(expected.status, 2);
      assert.equal(r.result.isError, true, `${name} blocked copy must set isError`);
      assert.deepEqual(JSON.parse(r.result.content[0].text), expected.value);
    });
  }
  const missingRule = await request('tools/call', { name: 'get_qa_rule', arguments: { id: 'missing' } });
  check('MCP unknown QA rule', () => {
    assert.equal(missingRule.result.isError, true);
    assert.equal(missingRule.result.content[0].text, cli('qa-rules', 'show', 'missing').value.error);
  });
  const oversized = JSON.stringify({ jsonrpc: '2.0', id: null, method: 'ping', padding: 'x'.repeat(65536) });
  const large = await raw(oversized, null, 'oversized frame');
  check('MCP frame limit', () => {
    assert.equal(large.error?.code, -32600);
    assert.equal(large.error?.message, 'Frame too large', 'MCP frame limit');
  });
  const recovered = await request('ping');
  check('MCP frame recovery', () => assert.deepEqual(recovered.result, {}, 'request after oversized frame'));
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
  if (!stopped) server.stdin.end();
  const timer = setTimeout(() => server.kill('SIGKILL'), 1000);
  await closed; clearTimeout(timer); lines.close();
}
const packDir = await mkdtemp(join(tmpdir(), 'aae-pack-'));
try {
  const packed = spawnSync('npm', ['pack', '--offline', '--ignore-scripts', '--json', '--pack-destination', packDir], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, npm_config_cache: join(packDir, 'cache') },
  });
  check('npm pack contents', () => {
    assert.equal(packed.status, 0, packed.stderr);
    const files = Object.values(JSON.parse(packed.stdout))[0].files.map(f => f.path);
    for (const file of ['LICENSE', 'README.md', 'bin/agentic-ads', 'bin/agentic-ads-mcp', 'src/hooks/library.json', 'src/formats/index.js', 'src/formats/library.json', 'src/qa/index.js', 'src/qa/rules.json']) assert.ok(files.includes(file));
    assert.ok(files.every(f => !f.startsWith('test/')));
  });
  const linked = join(packDir, 'agentic-ads');
  await symlink(resolve('bin/agentic-ads'), linked);
  const linkedRun = spawnSync(linked, ['list-hooks'], { encoding: 'utf8', timeout: 5000 });
  check('linked executable', () => { assert.equal(linkedRun.status, 0); assert.deepEqual(JSON.parse(linkedRun.stdout), hooks.value); });
} finally { await rm(packDir, { recursive: true, force: true }); }
const corpus = JSON.parse(await readFile('test/policy-corpus.json', 'utf8'));
check('policy corpus: honest copy has no blocks or targeting findings', () => {
  const wrong = corpus.honest.filter(t => {
    const r = cli('lint', '--copy', t).value;
    return r.status === 'blocked' || r.findings.some(f => f.code.startsWith('targeting_'));
  });
  assert.deepEqual(wrong, []);
});
check('policy corpus: flagged copy carries a targeting finding', () => {
  const missed = corpus.flagged.filter(([text, expect, code]) => {
    const r = cli('lint', '--copy', text).value;
    assert.ok(['blocked', 'finding_required'].includes(expect), 'unknown corpus label');
    return !r.findings.some(f => code ? f.code === code : f.code.startsWith('targeting_')) || (expect === 'blocked' && r.status !== 'blocked');
  }).map(x => x[0]);
  assert.deepEqual(missed, []);
});
check('policy corpus: hostile 20,000-character input stays fast', () => {
  for (const text of ['\uFDFA'.repeat(20000), '1'.repeat(19999) + 'a', '{{'.repeat(9999), 'no '.repeat(6666), 'home kids ages 5' + ' -'.repeat(9992), 'home aged 5' + ' -'.repeat(9994)]) {
    const samples = Array.from({ length: 3 }, () => {
      const start = process.hrtime.bigint();
      cli('lint', '--copy', text);
      return Number(process.hrtime.bigint() - start) / 1e6;
    });
    assert.ok(Math.min(...samples) < 500, `best of three: ${samples} ms`);
  }
});
await mkdir('test/artifacts', { recursive: true });
const artifact = { command: 'node test/e2e.mjs', node: process.version, passed: checks.length, checks };
await writeFile('test/artifacts/e2e.json', JSON.stringify(artifact, null, 2) + '\n');
console.log('PASS ' + checks.length + ' checks; test/artifacts/e2e.json');
