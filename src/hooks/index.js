import { readFileSync } from 'node:fs';
import { mkdir, readFile, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const hooks = Object.freeze(JSON.parse(readFileSync(new URL('./library.json', import.meta.url), 'utf8'))
  .map(hook => Object.freeze({ ...hook, tags: Object.freeze(hook.tags) })));
function validate(scores) {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) throw new Error('Invalid scores');
  for (const [id, value] of Object.entries(scores)) {
    if (!hooks.some(h => h.id === id) || !Number.isFinite(value) || value < 0) throw new Error('Invalid score');
  }
  return scores;
}
function pathFor(directory, site) {
  if (typeof site !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(site)) throw new Error('Invalid site slug');
  return join(directory, `${site}.json`);
}
/** Read an explicit site snapshot. Missing files are a cold start; corrupt files fail. */
export async function readScores(directory, site) {
  const path = pathFor(directory, site);
  try { return validate(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Cannot read scores'); }
}
/** Replace a site's snapshot atomically. Callers must use a single writer. */
export async function writeScores(directory, site, scores) {
  const path = pathFor(directory, site);
  const data = JSON.stringify(validate(scores));
  await mkdir(directory, { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  let handle;
  let created = false;
  try {
    handle = await open(temp, 'wx', 0o600);
    created = true;
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temp, path);
  } catch (error) {
    // Cleanup must never replace the original write, sync, close, or rename error.
    if (handle) await handle.close().catch(() => {});
    if (created) await unlink(temp).catch(() => {});
    throw error;
  }
}
/** Pure selection; scores belong to the supplied site snapshot. No disk, time, or random input.
 * @param {{id:string, scores?:Record<string,number>}} site
 * @param {string} goal
 */
export function selectFor(site, goal) {
  if (!site || typeof site !== 'object' || Array.isArray(site)) throw new Error('Invalid site');
  pathFor('.', site.id);
  const scores = validate(site.scores ?? {});
  const eligible = hooks.filter(h => h.risk === 'low' && h.tags.includes(goal));
  const ranked = eligible.map((hook, order) => ({ hook, order, score: scores[hook.id] ?? 0 }));
  ranked.sort((a, b) => b.score - a.score || a.order - b.order);
  return ranked.length ? structuredClone(ranked[0].hook) : null;
}
