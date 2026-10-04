export function reviewEmailText(review: {
  revision: { id: string; number: number; document: { title: string } };
  questions: { id: string; prompt: string; required: boolean }[];
}, answers?: Record<string, string>) {
  const header = `Private story feedback — not published\n${review.revision.document.title}\nPreview v${review.revision.number} · Reference ${review.revision.id}\n\nYour name:\n\n`;
  return header + (answers === undefined ? "My feedback:\n" : "These questions are optional. Answer only what you would like to share.\n\n" + review.questions.map((q, i) => `${i + 1}. ${q.prompt}\n${answers[q.id] || ""}`).join("\n\n"));
}

export function reviewEmailLink(email: string | undefined, title: string, text: string) {
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return undefined;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`Private story feedback: ${title}`)}&body=${encodeURIComponent(text)}`;
}
