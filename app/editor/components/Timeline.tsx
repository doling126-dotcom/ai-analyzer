"use client";

import { useEffect, useRef, useState } from "react";
import { Type, ZoomIn, ZoomOut } from "lucide-react";
import { clipDuration, formatTime, projectDuration, type EditOp } from "@/lib/video/ops";
import type { Project } from "@/lib/video/types";
import { C } from "../theme";

export default function Timeline({
  project,
  time,
  selectedId,
  onSeek,
  onSelect,
  apply,
  preview,
  commitFrom,
}: {
  project: Project;
  time: number;
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSelect: (id: string | null, jump?: boolean) => void;
  apply: (ops: EditOp[]) => boolean;
  preview: (base: Project, ops: EditOp[]) => void;
  commitFrom: (base: Project) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState<number | null>(null); // pixels per second; null = fit
  const [width, setWidth] = useState(800);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const trimming = useRef(false);
  const total = projectDuration(project);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = Math.max(4, (width - 40) / Math.max(total, 1));
  const scale = pps ?? fit;
  const contentWidth = Math.max(width - 2, total * scale + 40);

  const seekFromEvent = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const x = e.clientX - el.getBoundingClientRect().left + el.scrollLeft;
    onSeek(x / scale);
  };

  // Drag a clip edge to trim it. Changes preview live and become one undo step.
  const startTrim = (e: React.PointerEvent, clipId: string, edge: "start" | "end") => {
    e.stopPropagation();
    e.preventDefault();
    const base = project;
    const clip = base.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const x0 = e.clientX;
    trimming.current = true;
    const move = (ev: PointerEvent) => {
      const delta = ((ev.clientX - x0) / scale) * clip.speed;
      const patch =
        edge === "start"
          ? { start: Math.min(clip.start + delta, clip.end - 0.1) }
          : { end: Math.max(clip.end + delta, clip.start + 0.1) };
      preview(base, [{ op: "update_clip", clipId, patch }]);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      trimming.current = false;
      commitFrom(base);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const ticks: number[] = [];
  const step = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((s) => s * scale >= 70) ?? 600;
  for (let t = 0; t <= total + step; t += step) ticks.push(t);

  const starts: number[] = [];
  project.clips.reduce((acc, c) => {
    starts.push(acc);
    return acc + clipDuration(c);
  }, 0);

  return (
    <div className="border-t px-3 pt-2 pb-3" style={{ borderColor: C.border, backgroundColor: C.panel }}>
      <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: C.muted }}>
        <span>타임라인 · 클립 {project.clips.length}개 · {formatTime(total)}</span>
        <span className="hidden md:inline">
          — 클릭: 선택 · 가장자리 드래그: 트림 · 끌어서 순서 변경 · S: 자르기
        </span>
        <div className="flex-1" />
        <button title="축소" onClick={() => setPps(Math.max(2, scale / 1.5))}>
          <ZoomOut size={14} />
        </button>
        <button onClick={() => setPps(null)} className="underline">
          맞춤
        </button>
        <button title="확대" onClick={() => setPps(Math.min(400, scale * 1.5))}>
          <ZoomIn size={14} />
        </button>
      </div>
      <div ref={scrollRef} className="overflow-x-auto relative select-none">
        <div style={{ width: contentWidth }} className="relative">
          <div className="h-5 relative cursor-pointer" onClick={seekFromEvent}>
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute text-[10px] border-l pl-1"
                style={{ left: t * scale, color: C.muted, borderColor: C.border }}
              >
                {formatTime(t)}
              </span>
            ))}
          </div>
          <div
            className="h-20 relative"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onSelect(null);
                seekFromEvent(e);
              }
            }}
          >
            {project.clips.map((clip, i) => {
              const left = starts[i] * scale;
              const w = clipDuration(clip) * scale;
              const selected = clip.id === selectedId;
              return (
                <div
                  key={clip.id}
                  draggable
                  onDragStart={(e) => {
                    if (trimming.current) e.preventDefault();
                    else e.dataTransfer.setData("text/clip", clip.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(i);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const id = e.dataTransfer.getData("text/clip");
                    if (id && id !== clip.id) apply([{ op: "move_clip", clipId: id, toIndex: i }]);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(clip.id, false);
                    seekFromEvent(e);
                  }}
                  className="absolute top-0 bottom-0 rounded-md overflow-hidden border-2 cursor-pointer group"
                  style={{
                    left,
                    width: Math.max(w - 2, 3),
                    borderColor: selected ? C.accent : dragOver === i ? C.teal : "#3a3a4a",
                    backgroundColor: "#1c1c28",
                    backgroundImage: `url(/api/video/media/${clip.mediaId}/thumb?t=${((clip.start + clip.end) / 2).toFixed(1)})`,
                    backgroundSize: "auto 100%",
                    backgroundRepeat: "repeat-x",
                  }}
                  title={`#${i + 1} ${clip.label}`}
                >
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25" />
                  <div className="relative px-1.5 py-1 text-[10px] leading-tight space-y-0.5">
                    <div className="font-bold">
                      #{i + 1} {clip.speed !== 1 && <span style={{ color: C.teal }}>{clip.speed}x</span>}
                    </div>
                    {w > 60 && clip.label && <div className="truncate">{clip.label}</div>}
                    {w > 40 && clip.text && (
                      <div className="flex items-center gap-0.5 truncate" style={{ color: "#fde68a" }}>
                        <Type size={10} className="shrink-0" />
                        {clip.text.content}
                      </div>
                    )}
                  </div>
                  <div
                    onPointerDown={(e) => startTrim(e, clip.id, "start")}
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                  />
                  <div
                    onPointerDown={(e) => startTrim(e, clip.id, "end")}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                  />
                </div>
              );
            })}
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
            style={{ left: time * scale, backgroundColor: "#f87171" }}
          />
        </div>
      </div>
    </div>
  );
}
