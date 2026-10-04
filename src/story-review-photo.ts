import { useEffect, useRef, useState } from "react";

type PendingPhoto = { file: File; replacement: any; expires: number };
type StoredPhoto = Omit<PendingPhoto, "file"> & {
  file: { bytes: ArrayBuffer; name: string; type: string; lastModified: number };
};
export async function encodePendingPhoto(value: PendingPhoto): Promise<StoredPhoto> {
  const { file, ...details } = value;
  // WebKit can abort IndexedDB writes containing Blob/File objects. Plain
  // bytes survive reload in both engines; the original file is reconstructed.
  return { ...details, file: { bytes: await file.arrayBuffer(), name: file.name, type: file.type, lastModified: file.lastModified } };
}
export function decodePendingPhoto(value: StoredPhoto | PendingPhoto | undefined): PendingPhoto | undefined {
  if (!value) return undefined;
  if (value.file instanceof File) return value as PendingPhoto; // Existing device drafts.
  const file = value.file as StoredPhoto["file"];
  return { ...value, file: new File([file.bytes], file.name, { type: file.type, lastModified: file.lastModified }) };
}
// Device-only recovery of an unfinished selection. Uploads still use ScaleMule Storage.
async function stored(key: string, value?: PendingPhoto | null): Promise<PendingPhoto | undefined> {
  const encoded = value ? await encodePendingPhoto(value) : value;
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("story-review-pending-media", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("photos", value === undefined ? "readonly" : "readwrite");
      const store = tx.objectStore("photos");
      const request = value === undefined ? store.get(key) : value === null ? store.delete(key) : store.put(encoded, key);
      tx.oncomplete = () => {
        try { resolve(value === undefined ? decodePendingPhoto(request.result) : undefined); }
        catch (error) { reject(error); }
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export function usePendingPhoto(key: string | undefined) {
  const [photo, setPhoto] = useState<PendingPhoto | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState("");
  const generation = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    const at = ++generation.current;
    setPhoto(null); setSaved(false);
    if (key) void stored(key).then(value => {
      if (generation.current !== at) return;
      if (value && value.expires > Date.now()) { setPhoto(value); setSaved(true); }
      else if (value) void stored(key, null).catch(() => {});
    }).catch(() => {});
    return () => { generation.current++; };
  }, [key]);
  useEffect(() => {
    if (!photo?.file.type.startsWith("image/")) { setPreview(""); return; }
    const url = URL.createObjectURL(photo.file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo?.file]);
  async function select(file: File | null, replacement: any = null) {
    if (!key) return;
    const at = ++generation.current;
    const value = file ? { file, replacement, expires: Date.now() + 7 * 86400000 } : null;
    setPhoto(value); setSaved(false);
    const operation = chain.current.catch(() => {}).then(() => stored(key, value));
    chain.current = operation;
    try { await operation; if (generation.current === at) setSaved(!!value); }
    catch { if (generation.current === at) setSaved(false); }
  }
  return { photo, saved, preview, select };
}
