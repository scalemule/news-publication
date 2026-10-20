#!/usr/bin/env node
import { readFile, mkdir, writeFile, rename, open, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { PublicationArticleClient, articlePhotoHtmlMatches } from '../dist/article-workflow-client.js';

const help = `Usage:
  scalemule-article inspect --publication ID --article ID
  scalemule-article replace-cover --publication ID --article ID --file-id ID --expected-version N --metadata photo.json
  scalemule-article replace-photo --url ARTICLE_URL --file PHOTO --metadata photo.json --operation-key KEY

Credentials: SCALEMULE_API_KEY and SCALEMULE_ACCESS_TOKEN (normal authorized member).
Platform admins may use their normal access token with --application-id ID.
Optional --api-url URL defaults to https://api.scalemule.com.

replace-photo accepts a local file and uses normal member/API-key credentials.
It resolves the publication from its authorized API inventory, saves a private
upload checkpoint, resumes the same multipart part, waits for scan and measured
publication renditions, then attaches with the original article version fence.
It verifies article invariants and, with --url, the public page. The default
deadline is 30 seconds per run; a failure names its stage and preserves progress.
Reuse the same --operation-key, metadata and file when resuming. Optional
--state PATH and --timeout-ms N (maximum 120000). Review-managed articles stop
before uploading and require their existing exact-revision editorial workflow.

replace-cover selects an already public, scanned Photo asset. It reads measured
hero and social renditions, preserves the article text, and changes media with
the supplied version fence. It never uploads raw bytes, republishes the story,
starts narration, or silently enrolls a legacy story into collaboration.
Collaboration-managed articles must use their immutable review/release workflow.

photo.json: { "caption": "...", "credit": "...", "alt": "...",
  "rightsConfirmed": true, "aiGenerated": false, "label": null }
Optional metadata: focalPoint, socialRenditionKey (a Photo metadata lookup key).
The label is internal provenance, subject to each publication's caption policy.
Pending scan/renditions stop without changing the existing cover. Inspect the
same asset instead of uploading again. Output records API timing, not a claim
that every website/CDN cache already displays the new image.
`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true, strict: true,
    options: Object.fromEntries(['publication', 'article', 'file-id', 'expected-version', 'metadata', 'application-id', 'api-url', 'url', 'file', 'operation-key', 'state', 'timeout-ms'].map(k => [k, { type: 'string' }]).concat([['help', { type: 'boolean' }]])),
  });
  if (values.help || !positionals.length) {
    console.log(help);
  } else {
    const [command, ...extra] = positionals;
    const commandStarted = performance.now();
    const budget = Number(values['timeout-ms'] ?? 30000);
    if (!Number.isFinite(budget) || budget < 100 || budget > 120000) throw Error('--timeout-ms must be between 100 and 120000');
    const remaining = () => { const ms = Math.floor(budget - (performance.now()-commandStarted)); if (ms < 1) throw Error('Operation deadline reached; resume the same operation'); return ms; };
    if (extra.length || !['inspect', 'replace-cover', 'replace-photo'].includes(command)) throw Error('Use inspect, replace-cover or replace-photo; see --help');
    if (values.url) {
      if (!process.env.SCALEMULE_API_KEY || !process.env.SCALEMULE_ACCESS_TOKEN || values['application-id']) throw Error('URL resolution requires normal publication member/API-key credentials');
      const url = new URL(values.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Use the public HTTPS article URL, without a private review key');
      const api = values['api-url'] ?? 'https://api.scalemule.com';
      const apiOrigin = new URL(api); if (apiOrigin.protocol !== 'https:' || apiOrigin.username || apiOrigin.password) throw Error('Use an HTTPS platform API endpoint');
      const headers = { 'x-api-key': process.env.SCALEMULE_API_KEY, authorization: 'Bearer '+process.env.SCALEMULE_ACCESS_TOKEN };
      const get = async route => { const r = await fetch(api.replace(/\/$/,'')+route,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(Math.min(10000,remaining()))}); const v = await r.json(); if (!r.ok || !v.success) throw Error(`Article resolution HTTP ${r.status}`); return v.data; };
      const pubs = await get('/v1/blog/publications');
      const pub = pubs.items?.find(p=>new URL(p.canonical_url).origin===url.origin);
      if (!pub) throw Error('The caller has no publication grant for that article origin');
      const match = /^\/news\/([^/]+)\/?$/.exec(url.pathname);
      if (!match) throw Error('Use the publication article slug URL');
      const resolved = await get(`/v1/blog/publications/${encodeURIComponent(pub.id)}/article-content/${encodeURIComponent(decodeURIComponent(match[1]))}`);
      if (!resolved.article?.id) throw Error('No published article at this URL');
      if ((values.publication && values.publication !== pub.id) || (values.article && values.article !== resolved.article.id)) throw Error('Article URL and supplied IDs disagree');
      values.publication = pub.id; values.article = resolved.article.id;
    }
    for (const key of ['publication', 'article']) if (!values[key]) throw Error(`Missing --${key}`);
    if (!process.env.SCALEMULE_ACCESS_TOKEN) throw Error('SCALEMULE_ACCESS_TOKEN is required; use normal member or platform admin authorization');
    if (!values['application-id'] && !process.env.SCALEMULE_API_KEY) throw Error('Member calls also require SCALEMULE_API_KEY');
    const client = new PublicationArticleClient({
      apiUrl: values['api-url'] ?? 'https://api.scalemule.com',
      publicationId: values.publication,
      applicationId: values['application-id'],
      apiKey: process.env.SCALEMULE_API_KEY,
      accessToken: process.env.SCALEMULE_ACCESS_TOKEN,
    });
    const started = performance.now();
    if (command === 'inspect') {
      const [options, processing, collaboration] = await Promise.all([
        client.options(values.article), client.processing(values.article),
        client.get(values.article).then(current => ({ enabled: true, generation: current.generation, status: current.status })).catch(error => {
          if (error.status === 404 && error.message === 'Story collaboration is not enabled') return { enabled: false };
          throw error;
        }),
      ]);
      console.log(JSON.stringify({
        article_id: processing.article_id, version: processing.version,
        publication_status: processing.publication_status,
        workflow_version: options.workflow_version, profile_version: options.profile_version,
        capabilities: options.capabilities, narration: processing.narration,
        assets: processing.assets, collaboration, elapsed_ms: Math.round(performance.now() - started),
      }, null, 2));
    } else if (command === 'replace-photo') {
      for (const key of ['file','metadata','operation-key']) if (!values[key]) throw Error(`Missing --${key}`);
      if (values['application-id']) throw Error('Local-photo intake uses normal publication member credentials');
      const metadata = JSON.parse(await readFile(values.metadata,'utf8'));
      for (const key of ['caption','credit','alt']) if (typeof metadata[key] !== 'string') throw Error(`photo.json requires a string ${key}`);
      const key = createHash('sha256').update(JSON.stringify([values['api-url']??'https://api.scalemule.com',values.publication,values.article,values['operation-key']])).digest('hex');
      const statePath = values.state ?? join(homedir(),'.scalemule','newsroom','operations',key+'.json');
      await mkdir(dirname(statePath),{recursive:true,mode:0o700});
      const lockPath = statePath+'.lock';
      let lock;
      try { lock = await open(lockPath,'wx',0o600); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const pid = Number(await readFile(lockPath,'utf8'));
        if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Operation lock is invalid; inspect '+lockPath);
        let alive = true; try { process.kill(pid,0); } catch (e) { if (e.code === 'ESRCH') alive = false; else throw e; }
        if (alive) throw Error('This operation is already running; use its existing result');
        await unlink(lockPath); lock = await open(lockPath,'wx',0o600);
      }
      await lock.writeFile(String(process.pid)); await lock.close();
      try {
        let checkpoint;
        try { checkpoint = JSON.parse(await readFile(statePath,'utf8')); } catch(error) { if (error.code !== 'ENOENT') throw error; }
        const expectedVersion = Number(values['expected-version'] ?? checkpoint?.expectedVersion ?? (await client.processing(values.article,AbortSignal.timeout(remaining()))).version);
        const bytes = await readFile(values.file);
        const saveCheckpoint = async state => { const temp = statePath+'.'+process.pid+'.tmp'; await writeFile(temp,JSON.stringify(state),{mode:0o600}); await rename(temp,statePath); checkpoint = state; };
        const result = await client.uploadAndReplacePublishedCover({
          articleId:values.article, expectedVersion, operationKey:values['operation-key'],file:new Blob([bytes]),filename:basename(values.file),
          caption:metadata.caption,credit:metadata.credit,alt:metadata.alt,rightsConfirmed:metadata.rightsConfirmed,aiGenerated:metadata.aiGenerated,label:metadata.label,focalPoint:metadata.focalPoint,
          checkpoint,saveCheckpoint,timeoutMs:remaining(),
          onProgress:event=>console.error(JSON.stringify(event)),
        });
        if (values.url) {
          let visible = false;
          let failure;
          try {
            const images = [checkpoint?.payload?.cover_image_url, checkpoint?.payload?.og_image_url];
            while (!visible) {
              const response = await fetch(values.url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(Math.min(10000,remaining()))});
              const html = await response.text();
              visible = response.ok && images.every(Boolean) && articlePhotoHtmlMatches(html,images[0],images[1]);
              if (!visible) await new Promise(resolve=>setTimeout(resolve,Math.min(500,remaining())));
            }
          } catch(error) { failure = error.message; }
          if (!visible) {
            console.error(JSON.stringify({...result,state:'attached_public_verification_pending',stage:'public_page',message:'The API attachment is verified; public HTML visibility remains pending. Resume this same operation.',reason:failure}));
            process.exitCode = 2;
          } else console.log(JSON.stringify({...result,public_page_verified:true,total_elapsed_ms:Math.round(performance.now()-commandStarted)},null,2));
        } else console.log(JSON.stringify(result,null,2));
      } finally { await unlink(lockPath); }
    } else {
      for (const key of ['file-id', 'expected-version', 'metadata']) if (!values[key]) throw Error(`Missing --${key}`);
      const metadata = JSON.parse(await readFile(values.metadata, 'utf8'));
      for (const key of ['caption', 'credit', 'alt']) if (typeof metadata[key] !== 'string') throw Error(`photo.json requires a string ${key}`);
      if (typeof metadata.aiGenerated !== 'boolean' || !(metadata.label === null || typeof metadata.label === 'string')) throw Error('photo.json must explicitly record aiGenerated and label');
      const result = await client.replacePublishedCover({
        articleId: values.article, expectedVersion: Number(values['expected-version']),
        fileId: values['file-id'], caption: metadata.caption, credit: metadata.credit,
        alt: metadata.alt, rightsConfirmed: metadata.rightsConfirmed,
        aiGenerated: metadata.aiGenerated, label: metadata.label,
        focalPoint: metadata.focalPoint, socialRenditionKey: metadata.socialRenditionKey,
      });
      console.log(JSON.stringify({ article_id: result.post_id, version: result.version, state: 'cover_updated', elapsed_ms: Math.round(performance.now() - started) }, null, 2));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message, status: error.status, code:error.code, stage:error.stage, file_id:error.fileId }));
  process.exitCode = 1;
}
