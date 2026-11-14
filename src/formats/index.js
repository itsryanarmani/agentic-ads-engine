import { checklistFor, gateChecklistFor, costRatchet } from '../qa/index.js';
import libraryJson from './library.json' with { type: 'json' };
const library = libraryJson;
const costs = ['free', 'cheap', 'mid', 'expensive'], risks = ['low', 'medium', 'high'];
function argumentsFor(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new Error('Invalid format arguments');
}
/** Return isolated descriptors. Filters combine with AND. No providers run. */
export function listFormats(filter = {}) {
  argumentsFor(filter, ['costClass', 'risk']);
  if (filter.costClass !== undefined && !costs.includes(filter.costClass)) throw new Error('Invalid cost class');
  if (filter.risk !== undefined && !risks.includes(filter.risk)) throw new Error('Invalid risk');
  return structuredClone(library.filter(f => (!filter.costClass || f.costClass === filter.costClass) && (!filter.risk || f.policyRisk === filter.risk)));
}
export function getFormat(id) {
  const found = library.find(f => f.id === id);
  if (!found) throw new Error('Unknown format: ' + String(id));
  return structuredClone(found);
}
/** Costs describe a possible production run, never money spent by this planner. */
export function planFormat(input = {}) {
  argumentsFor(input, ['format', 'site', 'goal', 'dryRun', 'apply']);
  if (input.apply !== undefined && input.apply !== false) throw new Error('Apply is unavailable');
  if (input.dryRun !== undefined && input.dryRun !== true) throw new Error('Use dry-run; apply is unavailable');
  const f = getFormat(input.format);
  if (typeof input.site !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.site) || input.site.length > 80) throw new Error('Site must be a lowercase slug');
  const goal = input.goal ?? 'discovery';
  if (typeof goal !== 'string' || !goal.trim() || goal.length > 200) throw new Error('Invalid goal');
  const stages = f.stages.map(id => ({ id, provider: f.providers[id], estimatedCostUsd: f.providers[id].estimatedCostUsd }));
  const sum = key => Math.round(stages.reduce((n, s) => n + s.estimatedCostUsd[key], 0) * 1000) / 1000;
  return { format: f.id, site: input.site, goal, dryRun: true, applied: false, spendUsd: 0, stages,
    reviewChecklist: checklistFor(f), gateChecklist: gateChecklistFor(f), costRatchet,
    qaGates: f.qaGates, policyRisk: f.policyRisk, riskNotes: f.riskNotes,
    total: { low: sum('low'), high: sum('high'), note: f.estimatedCostUsd.note },
    warnings: ['Plan only; no providers or QA checks run.', 'NOT CHECKED blocks shipping. Record PASS or FAIL with a measured value. Voice fit and sound fit need the owner’s ear.', 'Historical source review dates are not current price verification.'] };
}
