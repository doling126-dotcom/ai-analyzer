"use client";

import { useRef, useState } from "react";
import { Link2, Loader2, Plus, Upload, Wand2 } from "lucide-react";
import { formatTime, type EditOp } from "@/lib/video/ops";
import type { Media, SpeechRange } from "@/lib/video/types";
import { C } from "../theme";

export default function Library({
  media,
  onUploaded,
  onError,
  onAddClips,
  clipCount,
}: {
  media: Media[];
  onUploaded: () => Promise<void>;
  onError: (msg: string) => void;
  onAddClips: (ops: EditOp[]) => void;
  clipCount: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [noise, setNoise] = useState(-35);
  const [minSilence, setMinSilence] = useState(0.5);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      for (const file of Array.from(files)) {
        setBusy(`업로드 중: ${file.name}`);
        const res = await fetch("/api/video/media", {
          method: "POST",
          headers: { "x-filename": encodeURIComponent(file.name) },
          body: file,
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      await onUploaded();
    } catch (err) {
      onError(`업로드 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importUrl = async () => {
    if (!url.trim()) return;
    setBusy("URL에서 가져오는 중…");
    try {
      const res = await fetch("/api/video/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUrl("");
      await onUploaded();
    } catch (err) {
      onError(`가져오기 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  };

  const addWhole = (m: Media) =>
    onAddClips([{ op: "insert_clip", mediaId: m.id, start: 0, end: m.duration, index: clipCount }]);

  const addAutoCut = async (m: Media) => {
    setBusy(`무음 구간 분석 중: ${m.name}`);
    try {
      const q = new URLSearchParams({ noise: String(noise), minSilence: String(minSilence) });
      const res = await fetch(`/api/video/media/${m.id}/speech?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const ranges = data.ranges as SpeechRange[];
      if (!ranges.length) throw new Error("소리가 있는 구간을 찾지 못했습니다");
      onAddClips(
        ranges.map((r, i) => ({
          op: "insert_clip" as const,
          mediaId: m.id,
          start: r.start,
          end: r.end,
          index: clipCount + i,
        }))
      );
    } catch (err) {
      onError(`자동 컷 실패: ${err instanceof Error ? err.message : err}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="rounded-xl border p-3 flex flex-col gap-3 min-h-0 overflow-y-auto text-sm"
      style={{ backgroundColor: C.panel, borderColor: C.border }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.teal }}>
        영상 라이브러리
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={!!busy}
        className="rounded-lg py-2 flex items-center justify-center gap-2 font-medium disabled:opacity-50"
        style={{ backgroundColor: C.accent }}
      >
        <Upload size={14} /> 영상 업로드
      </button>
      <div className="flex gap-1">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="영상 파일 URL (AI 생성 영상 등)"
          className="flex-1 min-w-0 rounded-md border px-2 py-1.5 text-xs bg-transparent outline-none"
          style={{ borderColor: C.border }}
        />
        <button
          onClick={importUrl}
          disabled={!!busy || !url.trim()}
          className="px-2 rounded-md border disabled:opacity-40"
          style={{ borderColor: C.border }}
          aria-label="URL 가져오기"
        >
          <Link2 size={14} />
        </button>
      </div>
      {busy && (
        <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          <Loader2 size={12} className="animate-spin" /> {busy}
        </div>
      )}

      <details className="text-xs" style={{ color: C.muted }}>
        <summary className="cursor-pointer">무음 컷 설정</summary>
        <div className="space-y-2 mt-2">
          <label className="block">
            무음 기준 {noise}dB (높일수록 더 많이 자름)
            <input type="range" min={-60} max={-15} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            최소 무음 길이 {minSilence}초
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.1}
              value={minSilence}
              onChange={(e) => setMinSilence(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </details>

      <div className="space-y-2">
        {media.length === 0 && (
          <p className="text-xs" style={{ color: C.muted }}>
            업로드한 영상이 여기에 표시됩니다.
          </p>
        )}
        {media.map((m) => (
          <div key={m.id} className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/video/media/${m.id}/thumb?t=${(m.duration / 2).toFixed(1)}`}
              alt=""
              className="w-full aspect-video object-cover bg-black"
            />
            <div className="p-2 space-y-1.5">
              <div className="text-xs truncate" title={m.name}>
                {m.name}
              </div>
              <div className="text-[11px]" style={{ color: C.muted }}>
                {formatTime(m.duration)} · {m.width}×{m.height}
                {!m.hasAudio && " · 무음"}
              </div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => addWhole(m)}
                  className="text-[11px] rounded border py-1 flex items-center justify-center gap-1"
                  style={{ borderColor: C.border }}
                >
                  <Plus size={11} /> 통째로
                </button>
                <button
                  onClick={() => addAutoCut(m)}
                  disabled={!!busy || !m.hasAudio}
                  title="말하지 않는 구간을 자동으로 잘라내고 추가"
                  className="text-[11px] rounded border py-1 flex items-center justify-center gap-1 disabled:opacity-40"
                  style={{ borderColor: C.border, color: C.teal }}
                >
                  <Wand2 size={11} /> 무음 컷
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
