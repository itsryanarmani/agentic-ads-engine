/** Conservative copy checks, not platform approval or factual verification.
 * @param {string} copy
 * @param {{category?:string}} options
 */
export function lint(copy, { category = 'housing' } = {}) {
  if (typeof copy !== 'string' || copy.length > 20000) throw new Error('Copy must be a string of at most 20000 characters');
  if (!['housing', 'none'].includes(category)) throw new Error('Unsupported category');
  const text = copy.normalize('NFKC');
  const findings = [];
  const add = (code, message, severity = 'error') => findings.push({ code, severity, message });
  if (!text.trim()) add('empty', 'Supply ad copy.');
  if (category !== 'housing' && /\b(home|homes|housing|house|houses|foreclosure|rent|property|properties|mortgage)\b/i.test(text)) add('housing_category', 'Declare the housing Special Ad Category.');
  const rules = [
    ['targeting', /\b(age[sd]?|years? old|zip|postal|young|seniors?|retirees?|millennials?|men only|women only)\b|\b\d{2}\s*\+/i, 'Remove age or postal targeting language.'],
    ['deceptive', /\b(guarantee\w*|risk[ -]?free|zero risk|no risk|double your money|instant profit)\b/i, 'Remove promises of certain outcomes.'],
    ['superlative', /\b(best|top|largest|fastest|cheapest|unbeatable|number one)\b|#\s*1\b/i, 'Remove banned superlatives.'],
    ['below_market', /(?:\d+(?:\.\d+)?\s*(?:%|percent)|percent)\s*(?:below|under|off)\s*(?:the\s+)?market/i, 'A below-market claim needs independent evidence and review.'],
    ['urgency', /\b(only today|ending soon|limited time|act now|last chance|only \d+ left)\b/i, 'Verify scarcity and timing before use.'],
    ['news', /\b(breaking|news alert)\b/i, 'News framing needs review and a clear ad disclosure.'],
    ['staging', /\b(before.{0,12}after|virtually staged|virtual staging|AI.staged)\b/i, 'Verify the source images and staging disclosure.'],
    ['private_data', /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|\b(?:\+?\d[\s().-]*){10,}\b/i, 'Remove contact data.'],
    ['placeholder', /\{\{.*?\}\}/, 'Replace unresolved slots before review.'],
  ];
  for (const [code, pattern, message] of rules) if (pattern.test(text)) add(code, message);
  add('human_review', 'Check facts, consent, disclosures, and platform rules before use.', 'warning');
  return { status: findings.some(f => f.severity === 'error') ? 'blocked' : 'review', category, findings };
}
