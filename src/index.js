import { templates } from './templates/index.js';
import { hooks, selectFor } from './hooks/index.js';
import { lint } from './policy/index.js';
import { templateProvider, guardCost } from './providers/index.js';
export { templates, hooks, selectFor, lint, templateProvider, guardCost };
export { readScores, writeScores } from './hooks/index.js';
const string = { type: 'string' };
const fields = {
  'list-templates': {}, 'list-hooks': {},
  lint: { copy: string, category: { enum: ['housing', 'none'], type: 'string' } },
  plan: { site: string, goal: string, template: string, ratio: { enum: ['4:5', '9:16'], type: 'string' }, copy: string, category: { enum: ['housing', 'none'], type: 'string' }, apply: { type: 'boolean' }, dryRun: { type: 'boolean' } },
};
export const tools = Object.entries(fields).map(([name, properties]) => ({
  name, description: ({ 'list-templates': 'List starter template descriptors.', 'list-hooks': 'List hook patterns and risks.', lint: 'Check ad copy; findings always require review.', plan: 'Preview a zero-cost plan. Apply is unavailable.' })[name],
  inputSchema: { type: 'object', properties, additionalProperties: false, ...(name === 'lint' ? { required: ['copy'] } : {}) },
}));
/** Shared CLI/MCP dispatch. Unknown inputs fail before any action. */
export function execute(action, args = {}) {
  if (!Object.hasOwn(fields, action)) throw new Error('Unknown action');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Invalid arguments');
  for (const [key, value] of Object.entries(args)) {
    const field = fields[action][key];
    if (!Object.hasOwn(fields[action], key) || typeof value !== field.type || (field.enum && !field.enum.includes(value))) throw new Error('Invalid argument');
    if (typeof value === 'string' && value.length > 20000) throw new Error('Argument too long');
  }
  if (action === 'list-templates') return structuredClone(templates);
  if (action === 'list-hooks') return structuredClone(hooks);
  if (action === 'lint') return lint(args.copy, args);
  if (args.apply === true) throw new Error('Apply is unavailable in this offline slice');
  if (args.dryRun === false) throw new Error('Use dry-run; apply is unavailable');
  const descriptor = templates.find(t => t.id === (args.template ?? 'door-open-teaser'));
  if (!descriptor) throw new Error('Unknown template');
  const site = args.site ?? 'demo';
  const hook = selectFor({ id: site }, args.goal ?? 'discovery');
  if (!hook) throw new Error('No low-risk hook matches this goal');
  const copy = args.copy ?? hook.pattern.replace('{{subject}}', 'available listings');
  const policy = lint(copy, args);
  const estimate = templateProvider.estimate();
  return { dryRun: true, applied: false, site, template: descriptor.id, ratio: args.ratio ?? '4:5', hook,
    copy, policy, estimate, costGuard: guardCost({ costMinor: 0, adSpentMinor: 0, monthSpentMinor: 0, perAdMinor: 0, perMonthMinor: 0 }),
    requiredSlots: descriptor.slots.map(s => s.name),
    warnings: ['No image is rendered or campaign launched.', 'Supply verified slots and brand tokens to the provider.', ...descriptor.risk === 'high' ? ['High-risk template requires additional review.'] : []],
  };
}
