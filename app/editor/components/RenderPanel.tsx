"use client";

import { useState } from "react";
import { Download, Film, Loader2 } from "lucide-react";
import type { Project } from "@/lib/video/types";
import { C } from "../theme";

type RenderState =
  | { status: "idle" }
  | { status: "rendering"; done: number; total: number }
  | { status: "done"; file: string; rendered: number; reused: number }
  | { status: "error"; message: string };

export default function RenderPanel({
  project,
  flushSave,
}: {
  project: Project;
  flushSave: () => Promise<void>;
}) {
  const [state, setState] = useState<RenderState>({ status: "idle" });
  const [warnings, setWarnings] = useState<string[]>([]);

  const render = async () => {
    setWarnings([]);
    setState({ status: "rendering", done: 0, total: project.clips.length });
    try {
      await flushSave();
      const res = await fetch(`/api/video/projects/${project.id}/render`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line);
          if (e.type === "clip") setState({ status: "rendering", done: e.index + 1, total: e.total });
          else if (e.type === "warning") setWarnings((w) => [...w, e.message]);
          else if (e.type === "done") setState({ status: "done", file: e.file, rendered: e.rendered, reused: e.reused });
          else if (e.type === "error") setState({ status: "error", message: e.message });
        }
      }
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs" style={{ color: C.muted }}>
        최종 영상을 {project.width}×{project.height} MP4로 만듭니다. 이전에 렌더링한 클립은
        재사용하고, 수정한 클립만 다시 인코딩해서 빠르게 끝나요.
      </p>
      <button
        onClick={render}
        disabled={state.status === "rendering" || project.clips.length === 0}
        className="w-full rounded-lg py-2.5 flex items-center justify-center gap-2 font-medium disabled:opacity-50"
        style={{ backgroundColor: C.accent }}
      >
        {state.status === "rendering" ? (
          <>
            <Loader2 size={14} className="animate-spin" /> 렌더링 중 {state.done}/{state.total}
          </>
        ) : (
          <>
            <Film size={14} /> 영상 렌더링
          </>
        )}
      </button>
      {state.status === "rendering" && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
          <div
            className="h-full transition-all"
            style={{ width: `${(state.done / Math.max(1, state.total)) * 100}%`, backgroundColor: C.teal }}
          />
        </div>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-xs text-yellow-300">
          {w}
        </p>
      ))}
      {state.status === "error" && <p className="text-xs text-red-400 break-words">{state.message}</p>}
      {state.status === "done" && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: C.teal }}>
            완료 — 새로 렌더링 {state.rendered}개, 재사용 {state.reused}개
          </p>
          <video
            src={`/api/video/renders/${state.file}`}
            controls
            className="w-full rounded-lg bg-black"
          />
          <a
            href={`/api/video/renders/${state.file}`}
            download={`${project.name}.mp4`}
            className="w-full rounded-lg py-2 flex items-center justify-center gap-2 border"
            style={{ borderColor: C.border }}
          >
            <Download size={14} /> MP4 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
