// Edit operations. The UI and the Claude editing assistant both describe
// changes as a list of these, so every edit is a small, local, undoable
// change to one clip instead of a full re-edit of the video.

import type { Clip, ClipText, Media, Project, SpeechRange } from "./types";

export type ClipPatch = Partial<
  Pick<
    Clip,
    "start" | "end" | "speed" | "volume" | "text" | "fadeIn" | "fadeOut" | "label"
  >
>;

export type EditOp =
  | { op: "update_clip"; clipId: string; patch: ClipPatch }
  | { op: "split_clip"; clipId: string; at: number }
  | { op: "delete_clip"; clipId: string }
  | { op: "move_clip"; clipId: string; toIndex: number }
  | { op: "duplicate_clip"; clipId: string }
  | {
      op: "insert_clip";
      mediaId: string;
      start: number;
      end: number;
      index: number;
    }
  | {
      op: "replace_media";
      clipId: string;
      mediaId: string;
      start: number;
      end: number;
    };

export const MIN_CLIP = 0.1;

export function newId(prefix = "c"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clipDuration(clip: Clip): number {
  return Math.max(0, (clip.end - clip.start) / clip.speed);
}

export function projectDuration(project: Project): number {
  return project.clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

export function defaultText(content: string): ClipText {
  return {
    content,
    position: "bottom",
    size: 56,
    color: "#ffffff",
    background: true,
  };
}

export function makeClip(mediaId: string, start: number, end: number): Clip {
  return {
    id: newId(),
    mediaId,
    start,
    end,
    speed: 1,
    volume: 1,
    text: null,
    fadeIn: 0,
    fadeOut: 0,
    label: "",
  };
}

/** Turn detected speech ranges into clips (silence is cut out). */
export function clipsFromRanges(mediaId: string, ranges: SpeechRange[]): Clip[] {
  return ranges.map((r) => makeClip(mediaId, r.start, r.end));
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

function sanitizeClip(clip: Clip, media: Media | undefined): Clip {
  const max = media?.duration ?? Number.POSITIVE_INFINITY;
  const start = clamp(clip.start, 0, Math.max(0, max - MIN_CLIP));
  const end = clamp(clip.end, start + MIN_CLIP, max);
  const length = end - start;
  const speed = clamp(clip.speed || 1, 0.25, 4);
  const outLen = length / speed;
  return {
    ...clip,
    start,
    end,
    speed,
    volume: clamp(clip.volume ?? 1, 0, 2),
    fadeIn: clamp(clip.fadeIn || 0, 0, outLen / 2),
    fadeOut: clamp(clip.fadeOut || 0, 0, outLen / 2),
    text: clip.text
      ? { ...clip.text, size: clamp(clip.text.size || 56, 12, 200) }
      : null,
  };
}

/**
 * Apply edit operations to a project and return a new project.
 * Throws on an operation that references an unknown clip or media.
 */
export function applyOps(
  project: Project,
  ops: EditOp[],
  mediaById: Record<string, Media>
): Project {
  let clips = [...project.clips];
  const indexOf = (id: string) => {
    const i = clips.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`Unknown clip: ${id}`);
    return i;
  };
  const requireMedia = (id: string) => {
    const m = mediaById[id];
    if (!m) throw new Error(`Unknown media: ${id}`);
    return m;
  };

  for (const op of ops) {
    switch (op.op) {
      case "update_clip": {
        const i = indexOf(op.clipId);
        const merged = { ...clips[i], ...op.patch };
        clips[i] = sanitizeClip(merged, mediaById[merged.mediaId]);
        break;
      }
      case "split_clip": {
        const i = indexOf(op.clipId);
        const c = clips[i];
        if (op.at <= c.start + MIN_CLIP || op.at >= c.end - MIN_CLIP) {
          throw new Error("Split point must be inside the clip");
        }
        const left = { ...c, end: op.at, fadeOut: 0 };
        const right = { ...c, id: newId(), start: op.at, fadeIn: 0 };
        clips.splice(i, 1, left, right);
        break;
      }
      case "delete_clip": {
        clips.splice(indexOf(op.clipId), 1);
        break;
      }
      case "move_clip": {
        const i = indexOf(op.clipId);
        const [c] = clips.splice(i, 1);
        clips.splice(clamp(Math.round(op.toIndex), 0, clips.length), 0, c);
        break;
      }
      case "duplicate_clip": {
        const i = indexOf(op.clipId);
        clips.splice(i + 1, 0, { ...clips[i], id: newId() });
        break;
      }
      case "insert_clip": {
        const m = requireMedia(op.mediaId);
        const c = sanitizeClip(makeClip(m.id, op.start, op.end), m);
        clips.splice(clamp(Math.round(op.index), 0, clips.length), 0, c);
        break;
      }
      case "replace_media": {
        const i = indexOf(op.clipId);
        const m = requireMedia(op.mediaId);
        clips[i] = sanitizeClip(
          { ...clips[i], mediaId: m.id, start: op.start, end: op.end },
          m
        );
        break;
      }
    }
  }
  clips = clips.filter((c) => c.end - c.start >= MIN_CLIP / 2);
  return { ...project, clips, updatedAt: new Date().toISOString() };
}

/** Locate the clip playing at output time `t`. */
export function locate(
  project: Project,
  t: number
): { index: number; offset: number; clipStart: number } | null {
  let acc = 0;
  for (let i = 0; i < project.clips.length; i++) {
    const d = clipDuration(project.clips[i]);
    if (t < acc + d || i === project.clips.length - 1) {
      return { index: i, offset: Math.min(Math.max(0, t - acc), d), clipStart: acc };
    }
    acc += d;
  }
  return null;
}

export function clipStartTime(project: Project, index: number): number {
  let acc = 0;
  for (let i = 0; i < index; i++) acc += clipDuration(project.clips[i]);
  return acc;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}
