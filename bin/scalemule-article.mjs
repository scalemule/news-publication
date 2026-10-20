#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PublicationArticleClient } from '../dist/article-workflow-client.js';

const help = `Usage:
  scalemule-article inspect --publication ID --article ID
  scalemule-article replace-cover --publication ID --article ID --file-id ID --expected-version N --metadata photo.json

Credentials: SCALEMULE_API_KEY and SCALEMULE_ACCESS_TOKEN (normal authorized member).
Platform admins may use their normal access token with --application-id ID.
Optional --api-url URL defaults to https://api.scalemule.com.

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
    options: Object.fromEntries(['publication', 'article', 'file-id', 'expected-version', 'metadata', 'application-id', 'api-url'].map(k => [k, { type: 'string' }]).concat([['help', { type: 'boolean' }]])),
  });
  if (values.help || !positionals.length) {
    console.log(help);
  } else {
    const [command, ...extra] = positionals;
    if (extra.length || !['inspect', 'replace-cover'].includes(command)) throw Error('Use inspect or replace-cover; see --help');
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
  console.error(JSON.stringify({ error: error.message, status: error.status }));
  process.exitCode = 1;
}
