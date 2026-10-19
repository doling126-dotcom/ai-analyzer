// ffmpeg helpers: probing, silence detection, thumbnails and rendering
// (server only). Each clip is rendered to its own cached segment keyed by a
// hash of its settings, so after a partial edit only the changed clips are
// re-encoded and the final video is a fast stream-copy concat.

import { spawn } from "child_process";
import { createHash } from "crypto";
import { existsSync, promises as fs } from "fs";
import path from "path";
import { clipDuration } from "./ops";
import type { Clip, Media, Project, SpeechRange } from "./types";
import {
  RENDER_DIR,
  SEGMENT_DIR,
  THUMB_DIR,
  ensureDirs,
  mediaFilePath,
} from "./storage";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

// Fonts with Korean glyphs, checked in order. Override with VIDEO_FONT_PATH.
const FONT_CANDIDATES = [
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
  "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  "/System/Library/Fonts/AppleSDGothicNeo.ttc",
  "/Library/Fonts/AppleGothic.ttf",
  "C:/Windows/Fonts/malgunbd.ttf",
  "C:/Windows/Fonts/malgun.ttf",
];

export function findFont(): string | null {
  const configured = process.env.VIDEO_FONT_PATH;
  if (configured && existsSync(configured)) return configured;
  return FONT_CANDIDATES.find((f) => existsSync(f)) ?? null;
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("error", (err) =>
      reject(new Error(`Failed to start ${cmd}: ${err.message}. Is ffmpeg installed?`))
    );
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited with ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export async function probe(
  file: string
): Promise<Pick<Media, "duration" | "width" | "height" | "hasAudio">> {
  const { stdout } = await run(FFPROBE, [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    file,
  ]);
  const info = JSON.parse(stdout) as {
    streams: { codec_type: string; width?: number; height?: number }[];
    format: { duration?: string };
  };
  const video = info.streams.find((s) => s.codec_type === "video");
  if (!video) throw new Error("No video stream found in file");
  return {
    duration: Number(info.format.duration) || 0,
    width: video.width ?? 0,
    height: video.height ?? 0,
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
  };
}

/** Detect the parts of a media file that are not silent. */
export async function detectSpeech(
  media: Media,
  opts: { noiseDb: number; minSilence: number; padding: number }
): Promise<SpeechRange[]> {
  if (!media.hasAudio) return [{ start: 0, end: media.duration }];
  const { stderr } = await run(FFMPEG, [
    "-hide_banner",
    "-i", mediaFilePath(media),
    "-af", `silencedetect=noise=${opts.noiseDb}dB:d=${opts.minSilence}`,
    "-vn",
    "-f", "null",
    "-",
  ]);
  const silences: SpeechRange[] = [];
  let pending: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) pending = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && pending !== null) {
      silences.push({ start: pending, end: Number(e[1]) });
      pending = null;
    }
  }
  if (pending !== null) silences.push({ start: pending, end: media.duration });

  const speech: SpeechRange[] = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start > cursor) speech.push({ start: cursor, end: s.start });
    cursor = Math.max(cursor, s.end);
  }
  if (cursor < media.duration) speech.push({ start: cursor, end: media.duration });

  return speech
    .map((r) => ({
      start: Math.max(0, r.start - opts.padding),
      end: Math.min(media.duration, r.end + opts.padding),
    }))
    .filter((r) => r.end - r.start >= 0.3)
    .map((r) => ({ start: round3(r.start), end: round3(r.end) }));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export async function thumbnail(media: Media, at: number): Promise<string> {
  await ensureDirs();
  const t = Math.max(0, Math.min(at, media.duration - 0.05));
  const out = path.join(THUMB_DIR, `${media.id}_${Math.round(t * 10)}.jpg`);
  if (existsSync(out)) return out;
  await run(FFMPEG, [
    "-hide_banner", "-y",
    "-ss", t.toFixed(3),
    "-i", mediaFilePath(media),
    "-frames:v", "1",
    "-vf", "scale=320:-2",
    "-q:v", "5",
    out,
  ]);
  return out;
}

function atempoChain(speed: number): string[] {
  const parts: string[] = [];
  let s = speed;
  while (s > 2) {
    parts.push("atempo=2");
    s /= 2;
  }
  while (s < 0.5) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts;
}

// Escape a value for use inside a quoted filter option.
function filterPath(p: string): string {
  return `'${p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")}'`;
}

function segmentKey(project: Project, clip: Clip, media: Media, font: string | null) {
  // id and label don't affect the pixels, so they are left out of the key.
  const settings = { ...clip, id: undefined, label: undefined };
  return createHash("sha1")
    .update(
      JSON.stringify({
        v: 2, // bump when segment rendering changes to invalidate the cache
        settings,
        media: [media.file, media.duration],
        out: [project.width, project.height, project.fps],
        font,
      })
    )
    .digest("hex")
    .slice(0, 20);
}

async function renderSegment(
  project: Project,
  clip: Clip,
  media: Media,
  font: string | null,
  out: string
) {
  const { width: W, height: H, fps } = project;
  const dur = clipDuration(clip);
  const srcLen = clip.end - clip.start;

  const v: string[] = [
    `setpts=(PTS-STARTPTS)/${clip.speed}`,
    `scale=${W}:${H}:force_original_aspect_ratio=decrease`,
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1",
    `fps=${fps}`,
  ];
  if (clip.text?.content.trim() && font) {
    const textFile = `${out}.txt`;
    await fs.writeFile(textFile, clip.text.content);
    const y =
      clip.text.position === "top"
        ? "h*0.06"
        : clip.text.position === "center"
          ? "(h-text_h)/2"
          : "h-text_h-h*0.08";
    const color = /^#[0-9a-fA-F]{6}$/.test(clip.text.color) ? clip.text.color : "#ffffff";
    v.push(
      [
        `drawtext=fontfile=${filterPath(font)}`,
        `textfile=${filterPath(textFile)}`,
        "expansion=none",
        `fontsize=${Math.round(clip.text.size)}`,
        `fontcolor=${color.replace("#", "0x")}`,
        "x=(w-text_w)/2",
        // Center each line of multi-line text (text_align needs ffmpeg 6.1+).
        ...(clip.text.content.includes("\n") ? ["text_align=C"] : []),
        `y=${y}`,
        `line_spacing=${Math.round(clip.text.size * 0.25)}`,
        clip.text.background
          ? `box=1:boxcolor=black@0.55:boxborderw=${Math.round(clip.text.size * 0.3)}`
          : `borderw=${Math.max(2, Math.round(clip.text.size / 18))}:bordercolor=black`,
      ].join(":")
    );
  }
  if (clip.fadeIn > 0) v.push(`fade=t=in:st=0:d=${clip.fadeIn}`);
  if (clip.fadeOut > 0) v.push(`fade=t=out:st=${(dur - clip.fadeOut).toFixed(3)}:d=${clip.fadeOut}`);
  v.push("format=yuv420p");

  const a: string[] = [];
  if (media.hasAudio) {
    a.push("asetpts=PTS-STARTPTS", ...atempoChain(clip.speed));
  }
  a.push(`volume=${media.hasAudio ? clip.volume : 0}`);
  if (clip.fadeIn > 0) a.push(`afade=t=in:st=0:d=${clip.fadeIn}`);
  if (clip.fadeOut > 0) a.push(`afade=t=out:st=${(dur - clip.fadeOut).toFixed(3)}:d=${clip.fadeOut}`);
  a.push("aresample=48000", "aformat=sample_fmts=fltp:channel_layouts=stereo");

  const args = [
    "-hide_banner", "-y",
    "-ss", clip.start.toFixed(3),
    "-t", srcLen.toFixed(3),
    "-i", mediaFilePath(media),
  ];
  if (!media.hasAudio) {
    args.push("-f", "lavfi", "-t", dur.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
  }
  args.push(
    "-filter_complex",
    `[0:v]${v.join(",")}[v];[${media.hasAudio ? "0:a" : "1:a"}]${a.join(",")}[a]`,
    "-map", "[v]",
    "-map", "[a]",
    "-t", dur.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-video_track_timescale", "90000",
    out
  );
  await run(FFMPEG, args);
}

export type RenderEvent =
  | { type: "clip"; index: number; total: number; cached: boolean }
  | { type: "done"; file: string; rendered: number; reused: number }
  | { type: "warning"; message: string };

export async function renderProject(
  project: Project,
  mediaById: Record<string, Media>,
  onEvent: (e: RenderEvent) => void
): Promise<string> {
  if (project.clips.length === 0) throw new Error("Project has no clips");
  await ensureDirs();
  const font = findFont();
  if (!font && project.clips.some((c) => c.text?.content.trim())) {
    onEvent({
      type: "warning",
      message: "No Korean-capable font found; text was skipped. Set VIDEO_FONT_PATH.",
    });
  }

  const segments: string[] = [];
  let rendered = 0;
  for (const [i, clip] of project.clips.entries()) {
    const media = mediaById[clip.mediaId];
    if (!media) throw new Error(`Clip ${i + 1} uses missing media ${clip.mediaId}`);
    const out = path.join(SEGMENT_DIR, `${segmentKey(project, clip, media, font)}.mp4`);
    const cached = existsSync(out);
    if (!cached) {
      const tmp = out.replace(/\.mp4$/, `.part.mp4`);
      await renderSegment(project, clip, media, font, tmp);
      await fs.rename(tmp, out);
      rendered++;
    }
    segments.push(out);
    onEvent({ type: "clip", index: i, total: project.clips.length, cached });
  }

  const listFile = path.join(RENDER_DIR, `${project.id}.txt`);
  await fs.writeFile(
    listFile,
    segments.map((s) => `file '${s.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n")
  );
  const fileName = `${project.id}_${Date.now()}.mp4`;
  await run(FFMPEG, [
    "-hide_banner", "-y",
    "-f", "concat", "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    "-movflags", "+faststart",
    path.join(RENDER_DIR, fileName),
  ]);
  onEvent({ type: "done", file: fileName, rendered, reused: segments.length - rendered });
  return fileName;
}
