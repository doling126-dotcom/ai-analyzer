import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "fs/promises";
import { thumbnail } from "@/lib/video/ffmpeg";
import { applyOps, clipDuration, type EditOp } from "@/lib/video/ops";
import { errorResponse } from "@/lib/video/serve";
import { mediaMap } from "@/lib/video/storage";
import type { Project } from "@/lib/video/types";

const client = new Anthropic();

const MAX_FRAMES = 40;

const SYSTEM_PROMPT = `You are the editing assistant inside a video editor. The video is a timeline of clips; each clip plays part of a source video (start/end in source seconds) with its own speed, volume, fades and optional on-screen text (subtitle/caption).

The user asks for changes in natural language, usually in Korean, and usually about specific parts ("3번 클립", "마지막 장면", "자막"). Clip numbers the user says are the 1-based "#" in the clip table. Translate the request into the smallest list of operations that does exactly what was asked, and leave every other clip untouched — the user relies on partial edits not disturbing the rest of the video.

Operations:
- update_clip: change fields of one clip. Only include fields that change. Set text to null to remove on-screen text. Trimming means changing start/end (source seconds, must stay within the media duration).
- split_clip: split a clip at a source time "at" strictly between its start and end.
- delete_clip, duplicate_clip.
- move_clip: toIndex is the 0-based position in the clip list after removal.
- insert_clip: add a new clip from a media file at a 0-based index.
- replace_media: swap the footage of a clip for another media file (keeps its text, speed and fades).

Operations are applied in order, and clip ids stay stable except that split_clip and duplicate_clip create new clips you cannot reference in the same response. Text size is in output pixels (the output height is given); 40–80 suits subtitles. Write on-screen text in the language the user uses. If frames are attached, use them to understand what each clip shows. If the request is ambiguous or impossible, return no operations and explain why in summary. The summary is shown to the user: write it in the user's language, one or two sentences.`;

const patchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    start: { type: "number" },
    end: { type: "number" },
    speed: { type: "number" },
    volume: { type: "number" },
    fadeIn: { type: "number" },
    fadeOut: { type: "number" },
    label: { type: "string" },
    text: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            content: { type: "string" },
            position: { type: "string", enum: ["top", "center", "bottom"] },
            size: { type: "number" },
            color: { type: "string", description: "#rrggbb" },
            background: { type: "boolean" },
          },
          required: ["content", "position", "size", "color", "background"],
        },
      ],
    },
  },
};

const opVariant = (op: string, properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  properties: { op: { type: "string", enum: [op] }, ...properties },
  required: ["op", ...Object.keys(properties)],
});

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    ops: {
      type: "array",
      items: {
        anyOf: [
          opVariant("update_clip", { clipId: { type: "string" }, patch: patchSchema }),
          opVariant("split_clip", { clipId: { type: "string" }, at: { type: "number" } }),
          opVariant("delete_clip", { clipId: { type: "string" } }),
          opVariant("move_clip", { clipId: { type: "string" }, toIndex: { type: "integer" } }),
          opVariant("duplicate_clip", { clipId: { type: "string" } }),
          opVariant("insert_clip", {
            mediaId: { type: "string" },
            start: { type: "number" },
            end: { type: "number" },
            index: { type: "integer" },
          }),
          opVariant("replace_media", {
            clipId: { type: "string" },
            mediaId: { type: "string" },
            start: { type: "number" },
            end: { type: "number" },
          }),
        ],
      },
    },
  },
  required: ["summary", "ops"],
};

// POST { project, instruction, selectedClipIds?, includeFrames? }
// → { summary, ops } — the client applies the ops so they can be undone.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      project: Project;
      instruction: string;
      selectedClipIds?: string[];
      includeFrames?: boolean;
    };
    const { project, instruction } = body;
    if (!project || !instruction?.trim()) {
      return errorResponse(new Error("project and instruction are required"), 400);
    }
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return errorResponse(new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다 (.env.local)"), 500);
    }
    const media = await mediaMap();

    let t = 0;
    const rows = project.clips.map((c, i) => {
      const row = {
        "#": i + 1,
        id: c.id,
        timelineStart: +t.toFixed(2),
        duration: +clipDuration(c).toFixed(2),
        mediaId: c.mediaId,
        start: c.start,
        end: c.end,
        speed: c.speed,
        volume: c.volume,
        fadeIn: c.fadeIn,
        fadeOut: c.fadeOut,
        text: c.text,
        label: c.label || undefined,
      };
      t += clipDuration(c);
      return row;
    });
    const usedMedia = Object.values(media).map((m) => ({
      id: m.id,
      name: m.name,
      duration: +m.duration.toFixed(2),
      hasAudio: m.hasAudio,
    }));

    const content: Anthropic.ContentBlockParam[] = [
      {
        type: "text",
        text: [
          `Output: ${project.width}x${project.height}, total ${t.toFixed(1)}s, ${project.clips.length} clips.`,
          `Media library:\n${JSON.stringify(usedMedia)}`,
          `Clips:\n${JSON.stringify(rows)}`,
          body.selectedClipIds?.length
            ? `Currently selected in the editor: ${body.selectedClipIds
                .map((id) => `#${project.clips.findIndex((c) => c.id === id) + 1}`)
                .join(", ")} (use these when the user says "this clip" / "선택한 클립").`
            : "No clip is selected.",
        ].join("\n\n"),
      },
    ];

    if (body.includeFrames !== false) {
      for (const [i, c] of project.clips.slice(0, MAX_FRAMES).entries()) {
        const m = media[c.mediaId];
        if (!m) continue;
        const jpg = await readFile(await thumbnail(m, (c.start + c.end) / 2));
        content.push(
          { type: "text", text: `Frame from clip #${i + 1}:` },
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") },
          }
        );
      }
    }
    content.push({ type: "text", text: `Request: ${instruction}` });

    const response = await client.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return errorResponse(new Error("Claude declined this request."), 422);
    }
    if (response.stop_reason === "max_tokens") {
      return errorResponse(new Error("The response was cut off. Try a smaller request."), 502);
    }
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return errorResponse(new Error("No response from Claude"), 502);
    }
    const result = JSON.parse(text.text) as { summary: string; ops: EditOp[] };

    // Dry run so invalid references are reported instead of half-applied.
    try {
      applyOps(project, result.ops, media);
    } catch (err) {
      return Response.json({
        summary: `${result.summary}\n(적용 실패: ${err instanceof Error ? err.message : err})`,
        ops: [],
      });
    }
    return Response.json(result);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return errorResponse(new Error("ANTHROPIC_API_KEY is missing or invalid"), 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return errorResponse(new Error("Rate limited by the Claude API, try again shortly"), 429);
    }
    if (err instanceof Anthropic.APIError) {
      return errorResponse(new Error(`Claude API error: ${err.message}`), err.status ?? 500);
    }
    return errorResponse(err);
  }
}
