import { describe, it, expect, vi } from "vitest";
import {
  PublicationArticleClient,
  ArticleWorkflowError,
  type ArticleDocument,
} from "./article-workflow-client";

describe("standard agent article package", () => {
  it("stages managed bytes, records explicit approval and resumes without another transfer or revision", async () => {
    const file = new Blob(["Photo bytes passed only to multipart"]),
      metadata = {
        caption: "Community gathering",
        credit: "Photographer",
        alt: "People at a gathering",
        creator: "Photographer",
        who_is_pictured: "Residents",
        when_taken: "2026-10-19",
        where_taken: "Community center",
        rights_confirmed: true,
      };
    const digest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
      ),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const document: ArticleDocument = {
      title: "A local story София 李 🙂",
      section: "Community",
      content_markdown: "Reported facts.",
    };
    let current = {
      post_id: "article",
      current_revision_id: "v1",
      generation: 1,
      status: "DRAFT",
      revisions: [{ id: "v1", document }],
      contributions: [] as any[],
    };
    let uploads = 0,
      saves = 0;
    const transport = vi.fn(
      async (url: URL | RequestInfo, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        let data: any;
        if (path.endsWith("/photos/register"))
          data = { id: "registered-photo" };
        else if (path.endsWith("/options"))
          data = {
            workflow_version: 1,
            formats: ["news"],
            layouts: [],
            capabilities: { managed_private_asset_upload: true },
          };
        else if (path.endsWith("/assets")) {
          expect(init?.body).toBeInstanceOf(FormData);
          expect(new Headers(init?.headers).get("If-Match")).toBe("1");
          uploads++;
          current.contributions = [
            {
              id: "contribution",
              kind: "MEDIA",
              state: "OPEN",
              payload: { ...metadata, file_id: "file", sha256: digest },
            },
          ];
          data = {
            contribution_id: "contribution",
            file_id: "file",
            kind: "image",
            state: "OPEN",
          };
        } else if (path.endsWith("/article-workflow")) {
          const body = JSON.parse(String(init?.body));
          expect(JSON.stringify(body)).not.toContain("Photo bytes");
          if (body.operation === "create")
            data = {
              article_id: "article",
              revision_id: "v1",
              generation: 1,
              editorial_status: "DRAFT",
              permalink_path: "/news/a/article",
              replayed: uploads > 0,
            };
          else {
            saves++;
            expect(body.expected_generation).toBe(2);
            expect(body.document.media[0]).not.toHaveProperty("state");
            current = {
              ...current,
              current_revision_id: "v2",
              generation: 3,
              revisions: [{ id: "v2", document: body.document }],
            };
            data = {
              article_id: "article",
              revision_id: "v2",
              generation: 3,
              editorial_status: "DRAFT",
            };
          }
        } else if (init?.method === "POST") {
          expect(JSON.parse(String(init.body))).toMatchObject({
            action: "RESOLVE",
            state: "APPROVED",
            expected_generation: 1,
          });
          current.contributions[0].state = "APPROVED";
          current.generation = 2;
          data = {};
        } else data = current;
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    );
    const client = new PublicationArticleClient({
      apiUrl: "https://api.example.test",
      publicationId: "paper",
      apiKey: "test-api-key",
      fetch: transport as typeof fetch,
    });
    const input = {
      operationKey: "community-story",
      authorProfileId: "author",
      document,
      assets: [
        {
          file,
          filename: "community.jpg",
          metadata,
          position: "hero" as const,
        },
      ],
      approveMedia: true,
    };
    expect((await client.submitArticle(input)).generation).toBe(3);
    expect((await client.submitArticle(input)).generation).toBe(3);
    expect(uploads).toBe(1);
    expect(saves).toBe(1);
    current.revisions[0].document = {
      ...current.revisions[0].document,
      title: "A subsequent editor changed this headline",
    };
    await expect(client.submitArticle(input)).rejects.toBeInstanceOf(
      ArticleWorkflowError,
    );
    expect(saves).toBe(1);
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
  expect(calls).toEqual([
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "GET", body: undefined },
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "POST", body: { expected_version: 9, asset_source_file_id: "private-source" } },
    { path: "/v1/blog/publications/paper/articles/story/collaboration/narrate", method: "POST", body: { expected_generation: 12 } },
    { path: "/v1/blog/publications/paper/articles/story/processing", method: "POST", body: { expected_version: 9, narration_profile_version: 8 } },
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
