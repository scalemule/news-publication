export type DiffRun = { kind: "same" | "added" | "removed"; text: string };
/** Token LCS with a bounded allocation; very long changes fall back to a changed passage. */
export function proseDiff(before: string, after: string): DiffRun[] {
  const tokens = (s: string) => s.match(/\s+|[\p{L}\p{N}\p{M}]+|[^\s]/gu) ?? [];
  const a = tokens(before),
    b = tokens(after),
    out: DiffRun[] = [];
  const emit = (kind: DiffRun["kind"], text: string) => {
    if (!text) return;
    const last = out.at(-1);
    if (last?.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let start = 0,
    endA = a.length,
    endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) {
    emit("same", a[start]);
    start++;
  }
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  if ((endA - start) * (endB - start) > 250000) {
    emit("removed", a.slice(start, endA).join(""));
    emit("added", b.slice(start, endB).join(""));
  } else {
    const n = endA - start,
      m = endB - start,
      grid = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        grid[i][j] =
          a[start + i] === b[start + j]
            ? grid[i + 1][j + 1] + 1
            : Math.max(grid[i + 1][j], grid[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && a[start + i] === b[start + j]) {
        emit("same", a[start + i]);
        i++;
        j++;
      } else if (i < n && (j === m || grid[i + 1][j] >= grid[i][j + 1])) {
        emit("removed", a[start + i]);
        i++;
      } else {
        emit("added", b[start + j]);
        j++;
      }
    }
  }
  emit("same", a.slice(endA).join(""));
  return out;
}
