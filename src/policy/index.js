// Normalize invisible separators and common Latin lookalikes before all checks.
const lookalikes = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ј: 'j', ѕ: 's', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', ι: 'i', α: 'a', ε: 'e', ο: 'o', ρ: 'p', χ: 'x', υ: 'y', κ: 'k', τ: 't', ν: 'v' };
function normalize(copy) {
  return copy.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[аеорсхуіјѕкмтвнαεορχυκτνι]/g, c => lookalikes[c]);
}
function hasContact(text) {
  // Each token/run is scanned once. Do not retry an unbounded suffix at every character.
  if (text.split(/\s+/).some(token => /^[^@]+@[^@.]+\.[^@]+$/.test(token))) return true;
  const withoutDates = text
    .replace(/\b(?:parcel(?:[ -]+id)?|assessor[ -]+parcel)[ :#-]*[\d-]+\b/g, ' ')
    .replace(/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\b/g, ' ');
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
  return /\b(?:homes?|housing|houses?|condos?|condominiums?|apartments?|leases?|leasing|renting|rented|townhouses?|duplex(?:es)?|landlords?|tenants?|bedrooms?|studios?|\d+br|flats?|real estate|foreclosures?|rent(?:al|als)?|propert(?:y|ies)|mortgages?|auctions?|listings?)\b/.test(subject);
}
// Bounded connectors keep cues attached to people, without scanning arbitrary prose.
const gap = '[ -]+';
const people = '(?:(?:tenants?|residents?|applicants?|people|households?|roommates?|families|with|or|and|pets|grad|job)' + gap + '){0,4}';
const cueBefore = '(?:only|no|not|prefer|preferred|ideal for|perfect for|must be|must have|exclude|excluding|not suitable for)';
const cueAfter = '(?:only|preferred|welcome|wanted|required|excluded|exclusive|not welcome|not accepted|not allowed|not permitted|prohibited|banned)';
function preference(subject) {
  return new RegExp('\\b(?:' + cueBefore + gap + people + '(?:' + subject + ')|(?:' + subject + ')' + gap + people + cueAfter + ')\\b');
}
const housingRules = [
  ['targeting_age', preference('young(?: professionals?| adults?)?|seniors?|retirees?|millennials?|students?|mature|elderly'), 'Remove age or student restrictions and preferences.'],
  ['targeting_familial_status', preference('children|kids|families|adults?|empty nesters'), 'Remove family-status restrictions and preferences.'],
  ['targeting_marital_status', preference('singles?|a bachelor|bachelors?|a couple|couples?|married|unmarried|divorced'), 'Remove marital-status restrictions and preferences.'],
  ['targeting_religion', preference('christians?|muslims?|jewish|jews?|hindus?|buddhists?|catholics?|protestants?|believers|religious'), 'Remove religious targeting or preferences.'],
  ['targeting_income', preference('section[ -]+(?:8|eight)|vouchers?|hud|housing assistance|public assistance|income source|job income'), 'Remove source-of-income restrictions or preferences.'],
  ['targeting_sex', preference('men|women|males?|females?|boys|girls|sex|gender|gay|straight'), 'Remove sex or gender restrictions and preferences.'],
  ['targeting_origin', preference('americans?|canadians?|chinese|indians?|mexicans?|british|french|arabs?|hispanics?|asians?|citizens?|native speakers?|english(?: speakers?)?|immigrants?|foreigners?|national origin|ethnicity|race|whites?|blacks?|minorities'), 'Remove race or national-origin restrictions and preferences.'],
  ['targeting_disability', preference('disabled|disabilities|wheelchairs?(?: users?)?|service animals?|able[ -]bodied|non[ -]disabled|wheelchair accessible'), 'Remove disability restrictions and preferences.'],
  // These phrases describe eligibility or preferred occupants, rather than a bare class word.
  ['targeting_age', /\b(?:(?:over|under|older than|younger than)[ -]+\d{1,3}[ -]+(?:community|residents?|tenants?|only)|(?:\d{1,3}|fifty[ -]five)[ -]*(?:\+|plus\b|(?:and|or)[ -]+(?:over|older|up)\b|years?[ -]+(?:old|(?:and|or)[ -]+(?:over|older))\b)|senior living|retirement community)\b/, 'Remove age eligibility language.'],
  ['targeting_age', /\b\d{1,3}\+(?=[ -]+(?:community|residents?|tenants?|only)\b)/, 'Remove age eligibility language.'],
  ['targeting_familial_status', /\b(?:family[ -]friendly|child[ -]free)\b/, 'Remove family-status preferences.'],
  ['targeting_religion', /\b(?:christian|muslim|jewish|hindu|buddhist|catholic|protestant)[ -]+(?:neighbou?rhood|community|building)(?!\s+(?:cent(?:er|re)|hall|school|hospital|museum|library|church|temple|mosque|synagogue))\b/, 'Remove religious neighborhood preferences.'],
  ['targeting_sex', /\b(?:gay|straight)[ -]friendly\b/, 'Remove sex or gender preferences.'],
  ['targeting_area', /\b(?:zip|postal)[ -]+(?:code[ -]+)?\d{1,10}[ -]+only\b|\b(?:target|targeting|exclude|excluding)\s+(?:residents?\s+)?(?:in\s+)?(?:(?:this|that|the|these|specific|selected)\s+)?(?:areas?|neighbou?rhoods?|districts?)\b|\b(?:locals?|area residents?)\s+only\b/, 'Remove postal or area targeting language.'],
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
    ['superlative', /\b(best(?![ -]street\b)|top(?![ -](?:floor\b|\d+\b))|largest|fastest|cheapest|unbeatable|number one)\b|#\s*1\b/, 'Remove banned superlatives.'],
    ['below_market', /\b(?:below|under|off|less[ -]+than|cheaper[ -]+than|discount(?:ed)?[ -]+(?:from|against|to))[ -]+(?:(?:the|current|local|fair|estimated|average|prevailing|open)[ -]+){0,5}(?:market|appraisal|appraised[ -]+value|comps)\b|\bmarket\s+(?:value|rates?|prices?)\s+(?:minus|less|discount)/, 'A below-market claim needs independent evidence and review.'],
    ['urgency', /\b(only today|ending soon|limited time|act now|last chance|only \d+ left)\b/, 'Verify scarcity and timing before use.'],
    ['news', /\b(breaking(?![ -]down\b)|news alert)\b/, 'News framing needs review and a clear ad disclosure.'],
    ['staging', /\b(before.{0,12}after|virtually staged|virtual staging|ai.staged)\b/, 'Verify the source images and staging disclosure.'],
  ];
  for (const [code, pattern, message] of rules) if (pattern.test(text)) add(code, message);
  if (hasContact(text)) add('private_data', 'Remove contact data.');
  if (hasPlaceholder(text)) add('placeholder', 'Replace unresolved slots before review.');
  add('human_review', 'Check facts, consent, disclosures, and platform rules before use.', 'warning');
  return { status: findings.some(f => f.severity === 'error') ? 'blocked' : 'review', category, findings };
}
