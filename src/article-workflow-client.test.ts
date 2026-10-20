import { describe, it, expect, vi } from "vitest";
import {
  PublicationArticleClient,
  ArticleWorkflowError,
  type ArticleDocument,
} from "./article-workflow-client";

describe("standard agent article package", () => {
  it("sends an article and its files in exactly one server request, including retries", async () => {
    const transport=vi.fn(async (url:URL|RequestInfo,init?:RequestInit)=>{
      expect(String(url)).toBe("https://api.example.org/v1/blog/publications/publication/submissions");
      expect(init?.method).toBe("POST");expect(init?.body).toBeInstanceOf(FormData);
      const form=init?.body as FormData;const manifest=JSON.parse(String(form.get("manifest")));
      expect(manifest.intent).toBe("publish");expect(manifest.article.document.title).toBe("News София 李 📰");
      expect(manifest.assets[0].slot).toBe("asset_a");expect(form.get("asset_a")).toBeInstanceOf(Blob);
      expect(new Headers(init?.headers).get("idempotency-key")).toBe("same-operation");
      expect(new Headers(init?.headers).has("content-type")).toBe(false);
      return Response.json({success:true,data:{submission_id:"receipt",article_id:"article",status:"queued",accepted_is_not_published:true}});
    });
    const client=new PublicationArticleClient({apiUrl:"https://api.example.org",publicationId:"publication",apiKey:"key",accessToken:"member",fetch:transport as typeof fetch});
    const input={operationKey:"same-operation",authorProfileId:"author",document:{title:"News София 李 📰",section:"Community",content_markdown:"Reported facts."},intent:"publish" as const,
      assets:[{file:new Blob(["test bytes"]),filename:"venue.png",position:"hero" as const,metadata:{caption:"Venue",credit:"Owner",alt:"Actual venue",creator:"Owner",who_is_pictured:"",when_taken:"",where_taken:"",rights_confirmed:true}}]};
    const first=await client.submitArticle(input);const replay=await client.submitArticle(input);
    expect(first.status).toBe("queued");expect(first.accepted_is_not_published).toBe(true);expect(replay.submission_id).toBe(first.submission_id);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not embed credentials in URLs or follow an API redirect", async () => {
    const transport = vi.fn(
      async (url: URL | RequestInfo, init?: RequestInit) => {
        expect(String(url)).not.toContain("test-token");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer test-token",
        );
        expect(init?.redirect).toBe("error");
        return new Response(
          JSON.stringify({ success: true, data: { workflow_version: 1 } }),
        );
      },
    );
    await new PublicationArticleClient({
      apiUrl: "https://api.example.test",
      publicationId: "paper",
      accessToken: "test-token",
      fetch: transport as typeof fetch,
    }).options();
  });
});

it("uses returned processing fences for explicit retries and revision narration without hidden work", async () => {
  const calls: { path: string; method: string; body?: any }[] = [];
  const client = new PublicationArticleClient({ apiUrl: "https://api.example.test", publicationId: "paper", fetch: (async (url, init) => {
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const path = new URL(String(url)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method: init?.method || "GET", body });
    const data = init?.method === "GET" ? { article_id: "story", version: 9, publication_status: "published", narration: { status: "held" }, visual: { status: "assigned", provider: "news_visual_desk", policy_governed: true }, assets: [{ source_file_id: "private-source", public_file_id: "existing-copy", status: "held", attempts: 6, last_progress_at: "2026-10-19T23:00:00Z" }] } : { status: "queued" };
    return Response.json({ success: true, data });
  }) as typeof fetch });
  const status = await client.processing("story");
  await client.retryProcessing(status.article_id, status.version, status.assets[0].source_file_id);
  await client.narrateRevision("story", 12);
  await client.retryProcessing(status.article_id, status.version, undefined, 8);
  await client.expediteNarration(status.article_id, status.version);
  expect(calls).toEqual([
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "GET", body: undefined },
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "POST", body: { expected_version: 9, asset_source_file_id: "private-source" } },
    { path: "/v1/blog/publications/paper/articles/story/collaboration/narrate", method: "POST", body: { expected_generation: 12 } },
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "POST", body: { expected_version: 9, narration_profile_version: 8 } },
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "POST", body: { expected_version: 9, expedite: true } },
  ]);
});

it("enrolls legacy articles only through an explicit approved workflow choice", async () => {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const client = new PublicationArticleClient({ apiUrl: "https://api.example.test", publicationId: "paper", fetch: (async(url, init) => {
    calls.push({method:init?.method || "GET",path:new URL(String(url)).pathname,body:init?.body ? JSON.parse(String(init.body)) : undefined});
    return Response.json({success:true,data:{post_id:"legacy",existing:true}});
  }) as typeof fetch });
  await client.get("legacy");
  await client.enableCollaboration("legacy","SUBJECT_APPROVAL_PLUS_EDITOR");
  expect(calls).toEqual([
    {method:"GET",path:"/v1/blog/publications/paper/articles/legacy/collaboration",body:undefined},
    {method:"POST",path:"/v1/blog/publications/paper/articles/legacy/collaboration/enable",body:{review_policy:"SUBJECT_APPROVAL_PLUS_EDITOR"}},
  ]);
});

it("updates an existing article in one JSON submission and refuses a service fallback",async()=>{
  const transport=vi.fn(async (_url:URL|RequestInfo,init?:RequestInit)=>{
    expect(JSON.parse(String(init?.body)).article).toMatchObject({operation:"save",article_id:"existing",expected_generation:7});
    return Response.json({success:false,error:{message:"Managed submission is not deployed"}},{status:404});
  });
  const client=new PublicationArticleClient({apiUrl:"https://api.example.org",publicationId:"publication",fetch:transport as typeof fetch});
  await expect(client.submit({article:{operation:"save",article_id:"existing",expected_generation:7,reason:"COPY_EDIT",document:{title:"Corrected",section:"Community",content_markdown:"Corrected."}},intent:"publish"},"edit-key")).rejects.toMatchObject({status:404});
  expect(transport).toHaveBeenCalledTimes(1);
});
