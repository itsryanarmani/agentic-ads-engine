// Normalize invisible separators and common Latin lookalikes before all checks.
const lookalikes = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's', к: 'k', м: 'm', т: 't', в: 'b', н: 'h' };
function normalize(copy) {
  return copy.normalize('NFKC').toLowerCase()
    .replace(/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[аеорсхуіјѕкмтвн]/g, c => lookalikes[c]);
}
function hasContact(text) {
  // Each token/run is scanned once. Do not retry an unbounded suffix at every character.
  if (text.split(/\s+/).some(token => /^[^@]+@[^@.]+\.[^@]+$/.test(token))) return true;
  const withoutDates = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');
  for (const match of withoutDates.matchAll(/[+\d][\d\s().-]*/g)) {
    const digits = match[0].replace(/\D/g, '').length;
    if (digits >= 10) return true;
  }
  return false;
}
function hasPlaceholder(text) {
  const start = text.indexOf('{{');
  return start !== -1 && text.indexOf('}}', start + 2) !== -1;
}
function hasHousing(text) {
  const subject = text.replace(/\b(?:apartment design games?|auction software|art listings?|lease accounting software|flat tires?|flat rates?|home page|home runs?|house music)\b/g, '');
  return /\b(?:homes?|housing|houses?|condos?|condominiums?|apartments?|lease|flats?|real estate|foreclosures?|rent(?:al|als)?|propert(?:y|ies)|mortgages?|auctions?|listings?)\b/.test(subject);
}
const housingRules = [
  ['targeting_age', /\b(?:young|seniors?|retirees?|millennials?|students?)\b|\b(?:over|under|age[sd]?|older than|younger than)\s+\d{1,3}\b|\b\d{1,3}\s*(?:\+|(?:and|or)\s+(?:older|younger|over)|years?\s*(?:old|(?:and|or)\s+(?:over|older)))/, 'Remove age or student restrictions and preferences.'],
  ['targeting_familial_status', /\b(?:children|kids|families|family[ -]friendly|adults?[ -]only|no adults|single(?:s)? only|couples only|child[ -]free)\b/, 'Remove family-status restrictions and preferences.'],
  ['targeting_religion', /\b(?:christians?|muslims?|jewish|jews?|hindu|buddhist|catholic|protestant|church|mosque|synagogue|religio(?:n|us))\b/, 'Remove religious targeting or preferences.'],
  ['targeting_income', /\b(?:section\s*8|vouchers?|public assistance|income source)\b/, 'Remove source-of-income restrictions or preferences.'],
  ['targeting_sex', /\b(?:men|women|male|female|boys|girls|sex|gender)[ -]+(?:(?:tenants?|residents?|applicants?)\s+)?(?:only|preferred|exclusive)|\b(?:no|only|prefer(?:red)?)\s+(?:men|women|males?|females?)\b/, 'Remove sex or gender restrictions and preferences.'],
  ['targeting_origin', /\b(?:americans?|canadians?|chinese|indians?|mexicans?|british|french|arabs?|hispanics?|asians?|citizens?|native speakers?|english speakers?|immigrants?|foreigners?|national origin|ethnicity|race)\s+(?:(?:tenants?|residents?|applicants?)\s+)?(?:only|preferred|excluded)|\b(?:no|only)\s+(?:immigrants?|foreigners?|americans?|canadians?|chinese|indians?|mexicans?|british|french|arabs?|hispanics?|asians?)\b/, 'Remove national-origin restrictions and preferences.'],
  ['targeting_disability', /\b(?:no|exclude|excluding|not suitable for)\s+(?:disabled|disabilities|wheelchairs?|service animals?)\b|\b(?:able[ -]bodied|non[ -]disabled)\s+only\b|\bmust be\s+(?:able[ -]bodied|non[ -]disabled)\b|\b(?:disabled|disabilities)\s+(?:only|excluded|not allowed)\b/, 'Remove disability restrictions and preferences.'],
  ['targeting_area', /\b(?:zip|postal)(?!(?:[ -]code)?[ -]free\b)(?:[ -]code)?\b|\b(?:target|targeting|exclude|excluding)\s+(?:residents?\s+)?(?:in\s+)?(?:(?:this|that|the|these|specific|selected)\s+)?(?:areas?|neighbou?rhoods?|districts?)\b|\b(?:locals?|area residents?)\s+only\b/, 'Remove postal or area targeting language.'],
];
/** Conservative copy checks, not platform approval or factual verification.
 * @param {string} copy
 * @param {{category?:string}} options
 */
export function lint(copy, options = {}) {
  if (typeof copy !== 'string' || copy.length > 20000) throw new Error('Copy must be a string of at most 20000 characters');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Invalid lint options');
  const { category = 'housing' } = options;
  if (!['housing', 'none'].includes(category)) throw new Error('Unsupported category');
  const text = normalize(copy);
  const findings = [];
  const add = (code, message, severity = 'error') => findings.push({ code, severity, message });
  if (!text.trim()) add('empty', 'Supply ad copy.');
  const housing = category === 'housing' || hasHousing(text);
  if (category !== 'housing' && housing) add('housing_category', 'Declare the housing Special Ad Category.');
  const rules = [
    ...(housing ? housingRules : []),
    ['deceptive', /\b(guarantee\w*|risk[ -]?free|zero risk|no risk|double your money|instant profit)\b/, 'Remove promises of certain outcomes.'],
    ['superlative', /\b(best|top(?![ -]floor\b)|largest|fastest|cheapest|unbeatable|number one)\b|#\s*1\b/, 'Remove banned superlatives.'],
    ['below_market', /\b(?:below|under|off|less than|cheaper than|discounted (?:from|against))\s+(?:(?:the|current|local|fair|estimated|average|prevailing|open)\s+){0,5}market\b|\bmarket\s+(?:value|rates?|prices?)\s+(?:minus|less|discount)/, 'A below-market claim needs independent evidence and review.'],
    ['urgency', /\b(only today|ending soon|limited time|act now|last chance|only \d+ left)\b/, 'Verify scarcity and timing before use.'],
    ['news', /\b(breaking|news alert)\b/, 'News framing needs review and a clear ad disclosure.'],
    ['staging', /\b(before.{0,12}after|virtually staged|virtual staging|ai.staged)\b/, 'Verify the source images and staging disclosure.'],
  ];
  for (const [code, pattern, message] of rules) if (pattern.test(text)) add(code, message);
  if (hasContact(text)) add('private_data', 'Remove contact data.');
  if (hasPlaceholder(text)) add('placeholder', 'Replace unresolved slots before review.');
  add('human_review', 'Check facts, consent, disclosures, and platform rules before use.', 'warning');
  return { status: findings.some(f => f.severity === 'error') ? 'blocked' : 'review', category, findings };
}
