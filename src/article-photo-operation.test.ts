import { describe, expect, it } from "vitest";
import { PublicationArticleClient, type ArticlePhotoInput, type PhotoOperationCheckpoint } from "./article-workflow-client";
function fixture(flags: {
    lostAttach?: boolean;
    lostComplete?: boolean;
    scan?: string;
    concurrent?: boolean;
    collaboration?: boolean;
    prepare?: boolean;
    sharedRole?: boolean;
    batch?: boolean;
} = {}) {
    let post: any = { id: "story", slug: "local-story", title: "София 李 🙂", content_markdown: "Verified original reporting.", content_html: "<p>Verified original reporting.</p>", version: 4, status: "published", visibility: "public", published_at: "2026-10-19T10:00:00Z", author_user_id: "author", audio_file_id: "existing-audio", metadata: { section: "Local", unrelated: { keep: true } } };
    const calls: {
        path: string;
        method: string;
        body?: any;
    }[] = [];
    let filename = "";
    const prepared = new Set<string>();
    let checkpoint: PhotoOperationCheckpoint | undefined;
    let lostAttach = flags.lostAttach, lostComplete = flags.lostComplete;
    const file = new Blob([new Uint8Array([255, 216, 255, 224, 1, 2, 3, 255, 217])]);
    const input: ArticlePhotoInput = { articleId: "story", expectedVersion: 4, operationKey: "outside-building-1", file, filename: "сграда-李🙂.jpg", caption: "Exterior entrance", credit: "Actual photographer", alt: "Exterior entrance София 李 🙂", rightsConfirmed: true, aiGenerated: false, label: null,
        saveCheckpoint: async (state) => { checkpoint = structuredClone(state); } };
    const transport = (async (raw: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(raw)), path = url.pathname;
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;
        calls.push({ path, method: init?.method ?? "GET", body });
        let data: any;
        if (url.hostname === "uploads.example.test") {
            expect(new Headers(init?.headers).has("authorization")).toBe(false);
            expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
            expect(init?.body).toBe(file);
            return new Response(null, { status: 200, headers: { etag: '"part-one"' } });
        }
        if (path.endsWith("/collaboration")) {
            if (flags.collaboration)
                data = { generation: 2 };
            else
                return new Response(JSON.stringify({ success: false, error: { message: "Story collaboration is not enabled" } }), { status: 404 });
        }
        else if (path.endsWith("/options"))
            data = { workflow_version: 1 };
        else if (path.endsWith("/document"))
            data = structuredClone(post);
        else if (path.endsWith("/multipart/start")) {
            expect(body.visibility).toBe("anonymous_visible");
            expect(body.metadata.operation_hash).toBe(body.client_upload_key);
            filename = body.filename;
            data = { file_id: "file", upload_session_id: "session", completion_token: "private-completion-token", total_parts: 1, part_urls: [{ part_number: 1, url: "https://uploads.example.test/part?signature=private" }] };
        }
        else if (path.endsWith("/info"))
            data = { filename };
        else if (path.endsWith("/multipart/complete")) {
            expect(body).toMatchObject({ file_id: "file", upload_session_id: "session", parts: [{ part_number: 1, etag: '"part-one"' }] });
            if (lostComplete) {
                lostComplete = false;
                throw Error("Lost completion acknowledgement");
            }
            data = { file_id: "file" };
        }
        else if (path.endsWith("/status"))
            data = { scan: { status: flags.scan ?? "clean" }, urls: { cdn_url: "https://cdn.example.test/scanned-original.jpg" } };
        else if (path.endsWith("/photos/register")) {
            expect(body.role).toBe("lead");
            expect(body.prepare_article_renditions).toBe(flags.batch===true);
            data = { id: "photo", prepared_article_renditions: flags.batch===true };
        }
        else if (path.endsWith("/policies/article/editor"))
            data = { capabilities:{batched_article_renditions:flags.batch===true}, roles: {
                    lead: { renditions: [{ width: 1200, fit: "scaledown", quality: 82, format: "webp" }, { width: 1200, fit: "scaledown", quality: 82, format: "jpeg" }] },
                    thumbnail: { renditions: [{ width: flags.sharedRole ? 1200 : 120, fit: "scaledown", quality: 82, format: "webp" }] },
                    social: { renditions: [{ width: 1200, height: 630, fit: "cover", quality: 88, format: "jpeg" }] },
                } };
        else if (path.endsWith("/manifest") && url.searchParams.has("preset"))
            data = { file_id: "file", width: 1600, height: 900, ready: false };
        else if (path.endsWith("/transform")) {
            expect(new Headers(init?.headers).has("authorization")).toBe(false);
            expect(new Headers(init?.headers).has("x-api-key")).toBe(false);
            const q = url.searchParams;
            prepared.add(`w${q.get("width")}_h${q.get("height") ?? 0}_${q.get("fit")}_q${q.get("quality")}_${q.get("format")}`);
            return new Response(null, { status: 302, headers: { location: "https://cdn.example.test/real-prepared-image" } });
        }
        else if (path.endsWith("/manifest")) {
            const key = url.searchParams.get("rendition")!;
            if (flags.prepare && !prepared.has(key))
                return new Response(JSON.stringify({ success: true, data: { file_id: "file", ready: false } }));
            data = { file_id: "file", ready: true, url: `https://cdn.example.test/${key}.image`, width: key.includes("w120_") ? 120 : 1198, height: key.includes("h630") ? 629 : key.includes("w120_") ? 67 : 674 };
        }
        else if (path.endsWith("/media")) {
            if (flags.concurrent)
                return new Response(JSON.stringify({ success: false, error: { message: "Article changed; reload" } }), { status: 409 });
            expect(body.expected_version).toBe(4);
            expect(body).not.toHaveProperty("content_markdown");
            // MySQL JSON may reorder keys. The exact values must still reconcile.
            const reorder = (v: any): any => Array.isArray(v) ? v.map(reorder) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reorder(x)])) : v;
            post = { ...post, version: 5, cover_image_url: body.cover_image_url, og_image_url: body.og_image_url, metadata: { ...post.metadata, cover_image: reorder(body.cover_image), open_graph_image: reorder(body.open_graph_image) } };
            if (lostAttach) {
                lostAttach = false;
                throw Error("Lost attach acknowledgement");
            }
            data = { post_id: "story", version: 5 };
        }
        else
            throw Error("Unexpected request: " + path);
        return new Response(JSON.stringify({ success: true, data }), { status: 200 });
    }) as typeof fetch;
    const client = new PublicationArticleClient({ apiUrl: "https://api.example.test", publicationId: "paper", apiKey: "member-api-key", accessToken: "member-token", fetch: transport });
    return { client, input, calls, checkpoint: () => checkpoint, post: () => post };
}
describe("repeatable local article photo operation", () => {
    it("uploads once, requires clean Storage and measured policy outputs, preserves text/audio and replays without another write", async () => {
        const f = fixture();
        expect(await f.client.uploadAndReplacePublishedCover(f.input)).toMatchObject({ state: "verified", version: 5, file_id: "file" });
        const write = f.calls.find(c => c.path.endsWith("/media"))!.body;
        expect(write.cover_image).toMatchObject({ width: 1198, height: 674, caption: f.input.caption, alt: f.input.alt });
        expect(write.open_graph_image).toMatchObject({ width: 1198, height: 629 });
        expect(f.post()).toMatchObject({ content_markdown: "Verified original reporting.", audio_file_id: "existing-audio", metadata: { unrelated: { keep: true } } });
        expect(await f.client.uploadAndReplacePublishedCover({ ...f.input, checkpoint: f.checkpoint() })).toMatchObject({ state: "already_applied", version: 5 });
        expect(f.calls.filter(c => c.path.endsWith("/multipart/start"))).toHaveLength(1);
        expect(f.calls.filter(c => c.path.endsWith("/media"))).toHaveLength(1);
        expect(f.calls.some(c => /narrate|publish$/.test(c.path))).toBe(false);
        expect(f.checkpoint()).not.toHaveProperty("completionToken");
    });
    it("uses the discovered server batch before attachment and makes no individual transform request", async()=>{
        const f=fixture({batch:true});
        expect(await f.client.uploadAndReplacePublishedCover(f.input)).toMatchObject({state:"verified",version:5});
        expect(f.calls.filter(c=>c.path.endsWith("/photos/register"))).toHaveLength(1);
        expect(f.calls.some(c=>c.path.endsWith("/transform"))).toBe(false);
    });
    it("prepares missing publication outputs through normal anonymous Photo transforms and then reads measured receipts", async () => {
        const f = fixture({ prepare: true });
        expect(await f.client.uploadAndReplacePublishedCover(f.input)).toMatchObject({ state: "verified" });
        expect(f.calls.filter(c => c.path.endsWith("/transform"))).toHaveLength(4);
        expect(f.calls.find(c => c.path.endsWith("/media"))!.body.cover_image.width).toBe(1198);
    });
    it("prepares one shared pixel output when publication roles request the same rendition", async () => {
        const f = fixture({ prepare: true, sharedRole: true });
        await f.client.uploadAndReplacePublishedCover(f.input);
        expect(f.calls.filter(c => c.path.endsWith("/transform"))).toHaveLength(3);
    });
    it("rejects animation and invalid provenance before any HTTP or upload", async () => {
        const f = fixture();
        await expect(f.client.uploadAndReplacePublishedCover({ ...f.input, file: new Blob(["GIF89a"]) })).rejects.toThrow("still JPEG");
        await expect(f.client.uploadAndReplacePublishedCover({ ...f.input, focalPoint: { x: 2, y: 0.5 } })).rejects.toThrow("Focal point");
        await expect(f.client.uploadAndReplacePublishedCover({ ...f.input, label: undefined as any })).rejects.toThrow("provenance label");
        expect(f.calls).toHaveLength(0);
    });
    it("reconciles a lost attachment acknowledgement without another media mutation", async () => {
        const f = fixture({ lostAttach: true });
        await expect(f.client.uploadAndReplacePublishedCover(f.input)).rejects.toMatchObject({ stage: "attach", fileId: "file" });
        expect(await f.client.uploadAndReplacePublishedCover({ ...f.input, checkpoint: f.checkpoint() })).toMatchObject({ state: "already_applied" });
        expect(f.calls.filter(c => c.path.endsWith("/media"))).toHaveLength(1);
    });
    it("replays completion on its same session after a lost acknowledgement, without another part transfer", async () => {
        const f = fixture({ lostComplete: true });
        await expect(f.client.uploadAndReplacePublishedCover(f.input)).rejects.toMatchObject({ stage: "complete" });
        await f.client.uploadAndReplacePublishedCover({ ...f.input, checkpoint: f.checkpoint() });
        expect(f.calls.filter(c => c.path.endsWith("/multipart/start"))).toHaveLength(1);
        expect(f.calls.filter(c => c.path === "/part")).toHaveLength(1);
        expect(f.calls.filter(c => c.path.endsWith("/multipart/complete"))).toHaveLength(2);
    });
    it.each(["threat", "quarantined", "error"])("preserves the old article for a %s scan", async (scan) => {
        const f = fixture({ scan });
        await expect(f.client.uploadAndReplacePublishedCover(f.input)).rejects.toMatchObject({ code: "SCAN_REJECTED", stage: "scan" });
        expect(f.calls.some(c => c.path.endsWith("/media"))).toBe(false);
        expect(f.post().version).toBe(4);
    });
    it("never overwrites a concurrent editor or makes a second upload to resolve a conflict", async () => {
        const f = fixture({ concurrent: true });
        await expect(f.client.uploadAndReplacePublishedCover(f.input)).rejects.toMatchObject({ stage: "attach" });
        expect(f.post().version).toBe(4);
        expect(f.calls.filter(c => c.path.endsWith("/media"))).toHaveLength(1);
    });
    it("stops before upload when immutable revision approval is required", async () => {
        const f = fixture({ collaboration: true });
        await expect(f.client.uploadAndReplacePublishedCover(f.input)).rejects.toMatchObject({ code: "REVISION_WORKFLOW_REQUIRED" });
        expect(f.calls.every(c => c.method === "GET")).toBe(true);
    });
    it("refuses changed input under an existing checkpoint before HTTP", async () => {
        const f = fixture();
        await f.client.uploadAndReplacePublishedCover(f.input);
        const before = f.calls.length;
        await expect(f.client.uploadAndReplacePublishedCover({ ...f.input, caption: "Other caption", checkpoint: f.checkpoint() })).rejects.toMatchObject({ code: "OPERATION_CONFLICT" });
        expect(f.calls).toHaveLength(before);
    });
    it("has a whole-operation deadline and names the blocked stage", async () => {
        const f = fixture({ scan: "pending" });
        const started = performance.now();
        await expect(f.client.uploadAndReplacePublishedCover({ ...f.input, timeoutMs: 100 })).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED", stage: "scan", fileId: "file" });
        expect(performance.now() - started).toBeLessThan(1500);
        expect(f.calls.some(c => c.path.endsWith("/media"))).toBe(false);
    });
});
