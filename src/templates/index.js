/** @typedef {{name:string, required:boolean, maxChars:number, source:string}} Slot */
/** @typedef {{id:string, version:number, name:string, aspectRatios:string[], slots:Slot[], beats:string[], risk:string}} Template */
const slot = (name, source = 'source') => ({ name, source, required: true, maxChars: 240 });
/** @type {Template[]} */
export const templates = [
  ['door-open-teaser', 'Door-open teaser', ['detail'], ['Door reveal', 'Show the actual condition', 'Invite a closer look'], 'low'],
  ['ugc-first-person', 'UGC first-person', ['experience', 'disclosure'], ['First-person introduction', 'Verified experience', 'Ad disclosure and invitation'], 'medium'],
  ['honest-before-after', 'Honest before/after', ['before', 'after', 'disclosure'], ['Same view before', 'Same view after', 'Explain actual or virtual changes'], 'medium'],
  ['breaking-news-frame', 'Breaking-news frame', ['fact', 'source', 'disclosure'], ['Brand update banner', 'Dated and sourced fact', 'Clearly identify this as an ad'], 'high'],
  ['help-urgency', 'Help/urgency', ['problem', 'help', 'timing'], ['Name the task', 'Offer practical help', 'Use only verified timing'], 'medium'],
].map(([id, name, extra, beats, risk]) => ({
  id, name, version: 1, aspectRatios: ['4:5', '9:16'], risk, beats,
  slots: [slot('headline', 'hook'), ...extra.map(x => slot(x)), slot('cta', 'cta')],
  brandTokens: ['name', 'primary', 'background', 'foreground'],
  renderer: 'template', costClass: 'free', policy: { textExact: true, imageMayContainText: false },
}));

// Freeze every nested descriptor so callers cannot change rendering limits or risk.
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
deepFreeze(templates);
