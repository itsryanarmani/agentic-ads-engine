import { createHash } from 'node:crypto';
import { templates } from '../templates/index.js';
/** @typedef {{capabilities:Function, estimate:Function, run:Function}} Provider */
/** Pure cap check in integer minor units of one caller-selected currency.
 * Existing spend must include reservations and uncertain charges.
 */
export function guardCost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid cost or cap');
  const values = {};
  for (const key of ['costMinor', 'adSpentMinor', 'monthSpentMinor', 'perAdMinor', 'perMonthMinor']) {
    if (!Object.hasOwn(input, key)) throw new Error(`Invalid cost or cap: ${key} must be an own property`);
    const value = input[key];
    values[key] = value;
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid cost or cap');
  }
  if ('apply' in input && !Object.hasOwn(input, 'apply')) throw new Error('Invalid cost or cap: apply must be an own property');
  const { costMinor, adSpentMinor, monthSpentMinor, perAdMinor, perMonthMinor } = values;
  const apply = input.apply;
  const reasons = [];
  if (costMinor > 0 && apply !== true) reasons.push('apply_required');
  if (costMinor > perAdMinor - adSpentMinor) reasons.push('per_ad_cap');
  if (costMinor > perMonthMinor - monthSpentMinor) reasons.push('monthly_cap');
  return { ok: reasons.length === 0, reasons };
}
const escape = value => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** HTML-to-image adapter stub. It emits deterministic HTML only, never a raster image. */
export const templateProvider = {
  id: 'html-template-stub',
  capabilities: () => ({ formats: ['text/html'], aspectRatios: ['4:5', '9:16'], imageRendering: false }),
  estimate: () => ({ costMinor: 0, currency: 'USD', confidence: 'exact' }),
  run(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid provider input');
    const { template, ratio = '4:5', slots, brand = {} } = input;
    const descriptor = templates.find(t => t.id === template);
    if (!descriptor || !descriptor.aspectRatios.includes(ratio)) throw new Error('Invalid template or ratio');
    if (!slots || typeof slots !== 'object' || Array.isArray(slots)) throw new Error('Invalid slots');
    if (!brand || typeof brand !== 'object' || Array.isArray(brand)) throw new Error('Invalid brand');
    if (Object.keys(slots).some(k => !descriptor.slots.some(s => s.name === k))) throw new Error('Unknown slot');
    if (Object.keys(brand).some(k => !descriptor.brandTokens.includes(k))) throw new Error('Unknown brand token');
    const colors = { primary: '#2455cc', background: '#ffffff', foreground: '#151515' };
    for (const key of Object.keys(colors)) {
      colors[key] = brand[key] ?? colors[key];
      if (typeof colors[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(colors[key])) throw new Error('Invalid brand color');
    }
    const name = brand.name ?? 'Demo';
    if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('Invalid brand name');
    const body = descriptor.slots.map(slot => {
      const value = Object.hasOwn(slots, slot.name) ? slots[slot.name] : undefined;
      if (typeof value !== 'string' || !value.trim() || value.length > slot.maxChars) throw new Error('Invalid required slot');
      return `<section data-slot="${slot.name}">${escape(value)}</section>`;
    }).join('');
    const width = 1080, height = ratio === '4:5' ? 1350 : 1920;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ad preview</title><style>body{margin:0;width:${width}px;height:${height}px;box-sizing:border-box;padding:80px;background:${colors.background};color:${colors.foreground};font:48px sans-serif}header{color:${colors.primary}}section{margin:40px 0;overflow-wrap:anywhere}</style></head><body data-template="${descriptor.id}"><header>${escape(name)}</header>${body}</body></html>`;
    return { html, mime: 'text/html', width, height, image: null, sha256: createHash('sha256').update(html).digest('hex'), costMinor: 0, warnings: ['Stub: HTML only; image rendering is unavailable.'] };
  },
};
