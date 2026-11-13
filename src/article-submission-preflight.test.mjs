import {describe,it,expect} from 'vitest';
import {submissionProblems} from '../bin/submission-preflight.mjs';

const options={capabilities:{headline_set:true},limits:{headline_recommended_characters:70}};
const manifest=()=>({intent:'publish',article:{operation:'create',review_policy:'CONTRIBUTOR_REVIEW',document:{
  title:'Contra Costa homeowners can challenge their assessment',headline:'Property assessment appeals due November 30',
  fly_title:'Real estate',subtitle:'How to request a county review.',seo_title:'Contra Costa assessment deadline',
}}});
describe('submission preflight',()=>{
  it('reports the actual failed-job headline and reason errors together before intake',()=>{
    const m=manifest();m.article.operation='save';m.article.reason='Updated the article';m.article.document.headline=m.article.document.title;
    const errors=submissionProblems(m,options);
    expect(errors).toHaveLength(2);expect(errors[0]).toContain('EDITOR_EDIT');expect(errors[1]).toContain('differ');
    m.article.reason='EDITOR_EDIT';m.article.document.headline='Assessment deadline approaches';
    expect(submissionProblems(m,options)).toEqual([]);
  });
  it('checks publish requirements together while allowing an incomplete review draft',()=>{
    const m=manifest();m.article.document={title:'A local story'};
    expect(submissionProblems(m,options)).toHaveLength(3);
    m.intent='review';expect(submissionProblems(m,options)).toEqual([]);
    delete m.article.review_policy;expect(submissionProblems(m,options)[0]).toContain('review_policy');
  });
  it.each(['A','Ж','学','📰'])('counts %s characters without truncating the content',c=>{
    const m=manifest();m.article.document.headline=c.repeat(70);
    expect(submissionProblems(m,options)).toEqual([]);
    m.article.document.headline+=c;
    expect(submissionProblems(m,options)).toEqual(['The short headline must be at most 70 characters for publication']);
  });
  it('normalizes case and whitespace when detecting a copied title',()=>{
    const m=manifest();m.article.document.title='СОФИЯ 東京 📰';m.article.document.headline='София  東京📰';
    expect(submissionProblems(m,options)).toContain('The short headline must differ from the long title');
  });
});
