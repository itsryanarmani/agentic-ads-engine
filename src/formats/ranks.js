/** Impulse-guide / lead-gen ranks from the 13 Nov 2026 format research. */
export const FORMAT_ALIASES = { checklist: 'notes-app' };
export const FORMAT_RANKS = {
  'notes-app': { rank: 1, wave: 'first', backend: 'html', prompt: 'A Notes list with a curiosity title and a blinking cursor.' },
  imessage: { rank: 2, wave: 'first', backend: 'html', prompt: 'A short iMessage thread: grey pain, blue recommendation, link card.' },
  'lo-fi': { rank: 3, wave: 'first', backend: 'wavespeed', model: 'bytedance/seedream-v5.5', prompt: 'A blurry 2000s phone selfie, crooked frame, no logos or text.' },
  'blurred-pdf': { rank: 4, wave: 'first', backend: 'html', prompt: 'A guide cover with a sharp title and a blurred body.' },
  'native-organic': { rank: 5, wave: 'first', backend: 'wavespeed', model: 'bytedance/seedream-v5.5', prompt: 'A candid phone photo that could pass as an organic post. No text.' },
  whiteboard: { rank: 6, wave: 'swap', backend: 'wavespeed', model: 'bytedance/seedream-v5.5', prompt: 'A blank whiteboard in a real room; handwriting is overlaid later.' },
  'us-vs-them': { rank: 7, wave: 'swap', backend: 'html', prompt: 'A split us-versus-them layout, both sides readable at a glance.' },
  'before-after': { rank: 8, wave: 'swap', backend: 'wavespeed', model: 'bytedance/seedream-v5.5', prompt: 'The same honest scene before and after, no fake results, no labels in the model.' },
  'zack-d': { rank: 9, wave: 'second', backend: 'wavespeed', model: 'google/nano-banana-2-lite/text-to-image', prompt: 'A 3D-style explainer still of the mechanism, no on-image words.' },
  stickman: { rank: 10, wave: 'second', backend: 'wavespeed', model: 'recraft-ai/recraft-v4.1-flash/text-to-image', prompt: 'A simple stickman explainer frame, 9:16, no tiny text.' },
  meme: { rank: 11, wave: 'test', backend: 'wavespeed', model: 'bytedance/seedream-v5.5', prompt: 'A native joke still. Keep the offer off the image.' },
  'chat-reveal': { rank: 12, wave: 'test', backend: 'html', prompt: 'A familiar chat layout with a sharp question and a useful answer.' },
};
const waves = ['first', 'swap', 'second', 'test'];
export function resolveFormatId(id) {
  return Object.hasOwn(FORMAT_ALIASES, id) ? FORMAT_ALIASES[id] : id;
}
export function getFormatRank(id) {
  const key = resolveFormatId(id);
  const row = FORMAT_RANKS[key];
  if (!row) throw new Error('Unknown format rank: ' + String(id));
  return { id: key, ...row };
}
/** Ranked formats first, then any unranked ids in the given order. */
export function rankFormats(ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Invalid format ids');
  const ranked = [], rest = [];
  for (const id of ids) {
    const key = resolveFormatId(id);
    if (FORMAT_RANKS[key]) ranked.push(getFormatRank(id));
    else rest.push({ id, rank: Infinity, wave: null });
  }
  ranked.sort((a, b) => a.rank - b.rank || ids.indexOf(a.id) - ids.indexOf(b.id));
  return [...ranked, ...rest];
}
export function formatsInWave(wave) {
  if (!waves.includes(wave)) throw new Error('Unknown wave');
  return Object.entries(FORMAT_RANKS)
    .filter(([, row]) => row.wave === wave)
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([id, row]) => ({ id, ...row }));
}
