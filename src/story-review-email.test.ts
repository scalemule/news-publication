import { expect, it } from "vitest";
import { reviewEmailLink, reviewEmailText } from "./story-review-email";
const review = { revision: { id: "private-revision-id", number: 2, document: { title: "София & 李 🎉" } }, questions: [{ id: "q", prompt: "What should we include?", required: false }] };
it("keeps Unicode answers and the exact revision reference, without a private access link", () => {
  const text = reviewEmailText(review, { q: "A family celebration — честито 🎉" });
  const link = reviewEmailLink("family@example.test", review.revision.document.title, text)!;
  const url = new URL(link);
  expect(url.searchParams.get("body")).toBe(text);
  expect(text).toContain("Preview v2 · Reference private-revision-id");
  expect(text).toContain("честито 🎉");
  expect(text).not.toContain("/review/");
  expect(reviewEmailText(review)).toContain("My feedback:");
});
it("does not offer an unconfigured mailbox or permit header injection", () => {
  for (const address of [undefined, "", "family@example.test?bcc=other@example.test", "family@example.test\r\nBcc: other@example.test"]) expect(reviewEmailLink(address, "Title", "Feedback")).toBeUndefined();
});
