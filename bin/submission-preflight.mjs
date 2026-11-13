// Cheap, side-effect-free checks before the first upload or durable submission.
// The server remains authoritative for grants, rights and exact-revision gates.
const reasons = new Set(['INITIAL_DRAFT','EDITOR_EDIT','AI_ASSISTED_DRAFT','SOURCE_PROPOSED_EDIT',
  'QUESTIONNAIRE_REGENERATION','FACT_CORRECTION','MEDIA_UPDATE','COPY_EDIT','EDITORIAL_FINAL','POST_PUBLICATION_CORRECTION']);
const text = value => typeof value === 'string' ? value.trim() : '';
const length = value => [...text(value)].length;
const fold = value => [...text(value)].map(c=>c.toLowerCase()).join('').replace(/\s/gu,'');

export function submissionProblems(manifest, options={}) {
  const errors=[];
  const article=manifest.article??{}, doc=article.document??{};
  if (!['create','save'].includes(article.operation)) errors.push('article.operation must be create or save');
  if (!['draft','review','publish'].includes(manifest.intent)) errors.push('intent must be draft, review or publish');
  if (article.operation==='create' && !text(article.review_policy)) errors.push('Choose article.review_policy explicitly; do not rely on the subject-approval default');
  if (article.operation==='save' && !reasons.has(article.reason)) errors.push('article.reason must be a revision reason such as EDITOR_EDIT, FACT_CORRECTION or MEDIA_UPDATE, not free-form text');
  if (options.capabilities?.headline_set && manifest.intent==='publish') {
    const max=options.limits?.headline_recommended_characters??70;
    if (!text(doc.headline)) errors.push('A short display headline is required');
    else {
      if (fold(doc.headline)===fold(doc.title)) errors.push('The short headline must differ from the long title');
      if (length(doc.headline)>max) errors.push(`The short headline must be at most ${max} characters for publication`);
      if (/[.…]$/u.test(text(doc.headline))) errors.push('The short headline must not end with a period');
    }
    if (!text(doc.subtitle)) errors.push('subtitle (the deck) is required for publication');
    if (!text(doc.seo_title)) errors.push('seo_title is required for publication');
    const fly=text(doc.fly_title);
    if (fly.includes('/') || (length(fly)>4 && [...fly].filter(c=>/\p{L}/u.test(c)).every(c=>/\p{Lu}/u.test(c)))) errors.push('fly_title must be a beat label, not a taxonomy path or all-caps label');
  }
  for (const [field,max] of [['headline',options.limits?.headline_characters??120],['fly_title',options.limits?.fly_title_characters??40],['subtitle',500],['seo_title',options.limits?.seo_title_characters??200]]) {
    if (doc[field]==null) continue;
    if (typeof doc[field]!=='string' || !text(doc[field])) errors.push(`${field} must be a nonblank string`);
    else if (length(doc[field])>max || /\p{Cc}/u.test(doc[field])) errors.push(`${field} exceeds its ${max}-character limit or contains control characters`);
  }
  return errors;
}
