"use client";

import { useEffect, useRef, useState } from "react";
import { clipDuration, clipStartTime, locate } from "@/lib/video/ops";
import type { Media, Project } from "@/lib/video/types";
import { C } from "../theme";

// Plays the timeline directly from the source files: one <video> element
// jumps between clips, and text/fades are drawn on top with CSS. This gives
// an instant preview of any edit without rendering.
export default function Preview({
  project,
  mediaById,
  time,
  seekVersion,
  playing,
  onTime,
  onEnded,
}: {
  project: Project;
  mediaById: Record<string, Media>;
  time: number;
  seekVersion: number;
  playing: boolean;
  onTime: (t: number) => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(-1);
  const projectRef = useRef(project);
  const timeRef = useRef(time);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    projectRef.current = project;
    timeRef.current = time;
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => setScale(box.clientWidth / project.width));
    ro.observe(box);
    return () => ro.disconnect();
  }, [project.width]);

  const load = (index: number, offset: number, autoplay: boolean) => {
    const v = videoRef.current;
    const clip = projectRef.current.clips[index];
    if (!v || !clip) return;
    indexRef.current = index;
    const target = clip.start + offset * clip.speed;
    const sync = () => {
      v.currentTime = target;
      v.playbackRate = clip.speed;
      v.volume = Math.min(1, clip.volume);
      v.muted = clip.volume === 0;
      if (autoplay) v.play().catch(() => {});
    };
    if (v.dataset.media !== clip.mediaId) {
      v.dataset.media = clip.mediaId;
      v.src = `/api/video/media/${clip.mediaId}`;
      v.addEventListener("loadedmetadata", sync, { once: true });
    } else {
      sync();
    }
  };

  // Seek / edit / play-state changes: position the video on the right clip.
  useEffect(() => {
    const v = videoRef.current;
    const loc = locate(projectRef.current, timeRef.current);
    if (!v) return;
    if (!loc) {
      v.pause();
      v.removeAttribute("src");
      delete v.dataset.media;
      return;
    }
    load(loc.index, loc.offset, playing);
    if (!playing) v.pause();
  }, [seekVersion, project, playing]);

  // While playing, follow the video and hop to the next clip at each cut.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      const p = projectRef.current;
      const i = indexRef.current;
      const clip = p.clips[i];
      if (v && clip) {
        if (v.currentTime >= clip.end - 0.03 || v.ended) {
          if (i + 1 < p.clips.length) {
            load(i + 1, 0, true);
          } else {
            v.pause();
            onTime(clipStartTime(p, p.clips.length));
            onEnded();
            return;
          }
        } else {
          const offset = Math.max(0, (v.currentTime - clip.start) / clip.speed);
          onTime(clipStartTime(p, i) + Math.min(offset, clipDuration(clip)));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const loc = locate(project, time);
  const clip = loc ? project.clips[loc.index] : null;
  let opacity = 1;
  if (clip && loc) {
    const d = clipDuration(clip);
    if (clip.fadeIn > 0) opacity = Math.min(opacity, loc.offset / clip.fadeIn);
    if (clip.fadeOut > 0) opacity = Math.min(opacity, (d - loc.offset) / clip.fadeOut);
    opacity = Math.max(0, Math.min(1, opacity));
  }
  const text = clip?.text?.content.trim() ? clip.text : null;
  const missing = clip && !mediaById[clip.mediaId];

  return (
    <div
      ref={boxRef}
      className="relative w-full rounded-xl overflow-hidden border mx-auto"
      style={{
        aspectRatio: `${project.width} / ${project.height}`,
        maxHeight: "52vh",
        maxWidth: `calc(52vh * ${project.width / project.height})`,
        backgroundColor: "#000",
        borderColor: C.border,
      }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-contain"
        style={{ opacity }}
        playsInline
        preload="auto"
      />
      {text && (
        <div
          className="absolute left-0 right-0 flex justify-center px-[4%] pointer-events-none"
          style={{
            top: text.position === "top" ? "6%" : text.position === "center" ? "50%" : undefined,
            bottom: text.position === "bottom" ? "8%" : undefined,
            transform: text.position === "center" ? "translateY(-50%)" : undefined,
            opacity,
          }}
        >
          <span
            className="font-bold text-center whitespace-pre-wrap"
            style={{
              fontSize: text.size * scale,
              lineHeight: 1.25,
              color: text.color,
              backgroundColor: text.background ? "rgba(0,0,0,0.55)" : undefined,
              padding: text.background ? text.size * 0.3 * scale : undefined,
              textShadow: text.background ? undefined : "0 0 4px #000, 0 0 2px #000",
            }}
          >
            {text.content}
          </span>
        </div>
      )}
      {project.clips.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: C.muted }}>
          왼쪽에서 영상을 업로드하고 타임라인에 추가하세요
        </div>
      )}
      {missing && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400">
          원본 영상을 찾을 수 없습니다
        </div>
      )}
    </div>
  );
}
