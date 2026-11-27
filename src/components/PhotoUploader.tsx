"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deletePhotoAction } from "@/app/actions";
import { photoUrl } from "./ReportView";

async function compress(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

export default function PhotoUploader({
  reportId,
  roomId,
  photos,
  phase = "move_in",
}: {
  reportId: string;
  roomId: string;
  photos: { id: string }[];
  phase?: "move_in" | "move_out";
}) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function upload(files: FileList) {
    setError("");
    const list = Array.from(files);
    for (const [i, f] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      const body = new FormData();
      const blob = await compress(f);
      body.append("file", new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: blob.type || "image/jpeg" }));
      body.append("roomId", roomId);
      body.append("phase", phase);
      const res = await fetch(`/api/reports/${reportId}/photos`, { method: "POST", body });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Upload failed");
    }
    setBusy("");
    router.refresh();
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((p) => (
          <div key={p.id} className="group relative">
            <a href={photoUrl(p.id)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.id)} alt="Room photo" className="h-20 w-28 rounded-md border border-stone-200 object-cover" />
            </a>
            <button type="button" aria-label="Remove photo"
              className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 text-xs text-white group-hover:block"
              onClick={async () => { await deletePhotoAction(reportId, p.id); router.refresh(); }}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="grid h-20 w-28 place-items-center rounded-md border border-dashed border-stone-300 text-xs text-stone-500 hover:border-brand hover:text-brand"
          onClick={() => input.current?.click()} disabled={Boolean(busy)}>
          {busy || (phase === "move_out" ? "+ Move-out photos" : "+ Add photos")}
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
