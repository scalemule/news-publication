import {mkdir, open, readFile, writeFile, rename, unlink} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

// Match scalemule_core::editorial_provenance::reader_citations. The reader API
// deliberately exposes five safe links, not private editorial provenance fields.
const readerCitations = citations => {
  const seen = new Set();
  return (citations??[]).flatMap(c => {
    if(c.reader_visible===false || typeof c.url!=='string' || typeof c.title!=='string' || !c.title.trim())return [];
    try {
      const url=new URL(c.url),host=url.hostname.replace(/\.$/u,'');
      if(Buffer.byteLength(c.url)>2048 || url.protocol!=='https:' || url.username || url.password
        || !host.includes('.') || isIP(host) || /\.(internal|local|localhost)$/iu.test(host))return [];
      const secrets=new Set(['token','password','apikey','accesstoken','secret','clientsecret','authorization','signature','key','xamzsignature','xamzcredential','xamzsecuritytoken','xgoogsignature','xgoogcredential']);
      if([...url.searchParams.keys()].some(k=>secrets.has(k.replace(/[^a-z0-9]/giu,'').toLowerCase())) || seen.has(c.url))return [];
      seen.add(c.url);return [{url:c.url,title:[...c.title].slice(0,500).join('')}];
    }catch{return [];}
  }).slice(0,5);
};

// A receipt is durable before any polling or invitation. Replaying a completed
// intake is a GET, not another upload or a client-side publishing workflow.
export async function submitWithCheckpoint(client, values, manifest, assets, remaining) {
  const identity = [values['api-url'] ?? 'https://api.scalemule.com', values.publication,
    values['application-id'] ?? null, values['operation-key']];
  const files = await Promise.all(assets.map(async a => ({slot:a.slot, filename:a.filename,
    sha256:hash(new Uint8Array(await a.file.arrayBuffer()))})));
  const fingerprint = hash(JSON.stringify(canonical({identity, manifest, files})));
  const path = values.state ?? join(homedir(), '.scalemule', 'newsroom', 'operations', hash(JSON.stringify(identity))+'.submission.json');
  await mkdir(dirname(path), {recursive:true, mode:0o700});
  const lockPath = path+'.lock';
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(await readFile(lockPath, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Invalid submission lock: '+lockPath);
    try { process.kill(pid, 0); throw Error('This submission is already running'); }
    catch (e) { if (e.code !== 'ESRCH') throw e; }
    await unlink(lockPath);
    lock = await open(lockPath, 'wx', 0o600);
  }
  await lock.writeFile(String(process.pid)); await lock.close();
  try {
    let state;
    try { state = JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state && (state.version !== 1 || state.fingerprint !== fingerprint))
      throw Error('Submission input changed. Restore the original manifest/files/key to resume; use a new operation for new content.');
    const save = async receipt => {
      state = {version:1, fingerprint, receipt, operation_key:values['operation-key']};
      const temp = path+'.'+process.pid+'.tmp';
      await writeFile(temp, JSON.stringify(state), {mode:0o600}); await rename(temp, path);
    };
    // Persist the identity before a possibly uncertain POST acknowledgement.
    const previous = state?.receipt;
    if (!state) await save(null);
    const started = performance.now();
    const replay = previous?.submission_id && previous.next_action !== 'retry_identical_submission';
    const receipt = replay
      ? await client.submission(previous.submission_id, AbortSignal.timeout(remaining()))
      : await client.submit(manifest, values['operation-key'], assets, AbortSignal.timeout(remaining()));
    await save(receipt);
    return {receipt, checkpoint_file:path, request_timings:[{stage:replay?'resume':'submit', elapsed_ms:Math.round(performance.now()-started)}], save};
  } catch (error) {
    error.checkpointFile = path;
    error.nextAction ??= 'resume_same_submission';
    throw error;
  } finally { await unlink(lockPath); }
}

function stopReason(receipt) {
  if (receipt.superseded || receipt.next_action === 'reload_current_revision') return 'superseded';
  if (receipt.status === 'held' || receipt.status === 'awaiting_review') return receipt.status;
  if (receipt.next_action === 'retry_identical_submission') return 'intake_pending';
  return null;
}

// Only compare the published projection with the receipt's immutable document.
// A cached, older but internally consistent public page is not success.
export function snapshotMatchesRevision(snapshot, current, receipt) {
  const doc = current.revisions?.find(r => r.id === receipt.revision_id)?.document;
  return current.published_revision_id === receipt.revision_id && snapshot.article?.id === receipt.article_id
    && snapshotMatchesDocument(snapshot, doc);
}

export function snapshotMatchesDocument(snapshot, doc) {
  const article = snapshot.article;
  if (!doc || article?.status !== 'published' || article.title !== doc.title || article.content_markdown !== doc.content_markdown) return false;
  for (const key of ['headline', 'subtitle', 'seo_title', 'fly_title'])
    if (doc[key] !== undefined && (article[key] ?? '') !== (doc[key] ?? '')) return false;
  if (doc.cards !== undefined && !equal(article.metadata?.cards ?? [], doc.cards ?? [])) return false;
  if (doc.citations !== undefined && !equal(article.metadata?.citations ?? [], readerCitations(doc.citations))) return false;
  if (doc.tag_ids && !equal([...doc.tag_ids].sort(), (article.tags??[]).map(t=>t.id).sort())) return false;
  return true;
}

/** Poll under ONE caller deadline, then verify the actual public page.
 * This never releases, approves, retries processing, or changes review policy. */
export async function waitForSubmission(client, initial, {
  remaining, save = async () => {}, onProgress = () => {},
  fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  editMatches, photoMatches,
}) {
  let receipt = initial;
  let stage = 'processing';
  const timings = [];
  const measured = async (name, fn) => {
    stage = name; const started = performance.now();
    try { return await fn(); }
    finally { timings.push({stage:name, elapsed_ms:Math.round(performance.now()-started)}); }
  };
  const result = (state, extra={}) => ({...receipt, state, stage, request_timings:timings, ...extra});
  const poll = async () => {
    await sleep(Math.min(1000, remaining()));
    receipt = await measured('processing', () => client.submission(receipt.submission_id, AbortSignal.timeout(remaining())));
    await save(receipt);
  };
  let lastState;
  try {
    while (true) {
      remaining();
      const progress = JSON.stringify([receipt.status, receipt.error_code, receipt.next_action]);
      if (progress !== lastState) {
        onProgress({stage:'processing', submission_id:receipt.submission_id, status:receipt.status,
          error_code:receipt.error_code, next_action:receipt.next_action}); lastState = progress;
      }
      const stopped = stopReason(receipt);
      if (stopped) return result(stopped);
      if (receipt.status === 'complete' && ['draft','review'].includes(receipt.progress?.intent)) return result('prepared');
      const retired = receipt.processing?.assets?.filter(a => a.status === 'retired') ?? [];
      if (receipt.status === 'published' && !receipt.public_ready && retired.length)
        return result('published_processing_blocked', {
          reason:'Server public readiness includes retired media. Inspect article processing; do not upload again or bypass readiness.',
          blocked_assets:retired.map(a=>({source_file_id:a.source_file_id,status:a.status})),
        });
      if (receipt.status !== 'published' || !receipt.public_ready) { await poll(); continue; }
      if (!receipt.article_id || !receipt.revision_id || !/^\/news\/[^/?#]+$/u.test(receipt.permalink_path??''))
        return result('verification_blocked', {reason:'Receipt lacks an exact revision or permanent article path'});
      const verifiedRevision = receipt.revision_id;
      const verifiedArticle = receipt.article_id;
      const current = await measured('revision', () => client.get(receipt.article_id, AbortSignal.timeout(remaining())));
      if (current.published_revision_id !== receipt.revision_id) return result('superseded', {next_action:'reload_current_revision'});
      const origin = new URL(current.review_origin);
      if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/')
        throw Error('Publication has no valid canonical HTTPS origin');
      const url = new URL(receipt.permalink_path, origin);
      const slug = decodeURIComponent(url.pathname.slice('/news/'.length));
      const snapshot = await measured('public_snapshot', () => client.publicArticle(slug, AbortSignal.timeout(remaining())));
      if (!snapshotMatchesRevision(snapshot, current, receipt)) { await poll(); continue; }
      const article = snapshot.article;
      const response = await measured('public_page', async () => {
        const page = await fetcher(url, {redirect:'error', cache:'no-store', signal:AbortSignal.timeout(Math.min(5000, remaining()))});
        return {ok:page.ok, html:await page.text()};
      });
      const cover = article.metadata?.cover_image;
      const leads = [article.cover_image_url, ...(cover?.variants??[]).map(v=>v.url)].filter(Boolean);
      const matches = response.ok && snapshot.author?.slug && article.cover_image_url && article.og_image_url
        && editMatches(response.html, {title:article.title, headline:article.headline, seo_title:article.seo_title,
          content_html:article.content_html, card_titles:(article.metadata?.cards??[]).map(c=>c.title), tags:article.tags})
        && photoMatches(response.html, leads, article.og_image_url)
        && response.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, '').includes('/authors/'+snapshot.author.slug);
      if (!matches) { await poll(); continue; }
      // Close the read/HTML race: a concurrent publication invalidates this receipt.
      receipt = await measured('confirm_revision', () => client.submission(receipt.submission_id, AbortSignal.timeout(remaining())));
      await save(receipt);
      const stop = stopReason(receipt);
      if (stop) return result(stop);
      if (receipt.revision_id !== verifiedRevision || receipt.article_id !== verifiedArticle) continue;
      if (receipt.status !== 'published' || !receipt.public_ready) { await poll(); continue; }
      return result('published_and_verified', {url:url.href, public_page_verified:true});
    }
  } catch (error) {
    return result(receipt.status==='published'?'published_verification_pending':'pending',
      {reason:error.message, next_action:receipt.next_action, error_status:error.status});
  }
}
