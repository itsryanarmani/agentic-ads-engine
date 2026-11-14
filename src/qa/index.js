import rulesJson from './rules.json' with { type: 'json' };
import gatesJson from './gates.json' with { type: 'json' };
const rules = rulesJson;
const gates = gatesJson;
export function gateChecklistFor(format) {
  return format.qaGates.map(id => {
    if (!Object.hasOwn(gates, id)) throw new Error('Unknown QA gate: ' + id);
    return { id, check: gates[id], status: 'NOT CHECKED' };
  });
}
export function listRules() { return structuredClone(rules); }
export function getRule(id) {
  const rule = rules.find(r => r.id === id);
  if (!rule) throw new Error('Unknown QA rule: ' + String(id) + '. Use qa-rules to list available IDs.');
  return structuredClone(rule);
}
/** Accept a format descriptor. Review status never implies that checks ran. */
export function checklistFor(format) {
  return format.feedbackRules.map(id => {
    const { title, check } = getRule(id);
    return { id, title, check, status: 'NOT CHECKED' };
  });
}
export const costRatchet = "Set a hard cap before you spend. One writer per spend log.\nReuse faces, sets, stills, clips and voice ids from earlier videos first.\nPick one lip-sync model for a format and keep it. Do not repeat a bake-off.\nDo not make the same still twice. Do not pay for an unused line.\nWrite `COST_NOTES.md`. Show cost per stage and against the last video of the format.\nA video that costs more than the last one of its format needs a one-line reason.";
