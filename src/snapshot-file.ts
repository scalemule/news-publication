import { randomBytes } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { acceptSnapshot, parseSnapshot, syncPublication, type PublicationSnapshot, type SnapshotHooks, type SyncedPublication } from "./snapshot";

export async function readSnapshotFile(file: string): Promise<PublicationSnapshot | null> {
  try {
    return parseSnapshot(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Replace the snapshot only after the new file is fully written.
 * A crash or a failed write leaves the previous file in place.
 */
export async function writeSnapshotFile(file: string, snapshot: PublicationSnapshot): Promise<void> {
  const accepted = acceptSnapshot(snapshot);
  if (!accepted) throw new Error("Refusing to store an incomplete publication snapshot");
  const temporary = join(dirname(file), `.publication-snapshot-${randomBytes(6).toString("hex")}.tmp`);
  await writeFile(temporary, `${JSON.stringify(accepted)}\n`, "utf8");
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/**
 * Read the shipped snapshot, try the application, and write only a good result.
 * A failed sync returns the file already on disk and does not touch it.
 */
export async function syncPublicationFile(input: {
  file: string;
  fetchRecord: () => Promise<unknown>;
  expectedSlug?: string;
  now?: number;
  hooks?: SnapshotHooks;
}): Promise<SyncedPublication> {
  const previous = await readSnapshotFile(input.file);
  const synced = await syncPublication({ ...input, previous });
  if (synced.source === "fresh") {
    try {
      await writeSnapshotFile(input.file, synced.snapshot);
    } catch {
      // The response is still the fresh record. The file keeps the last durable copy.
    }
  }
  return synced;
}
