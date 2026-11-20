"use client";

import { ChevronLeft, ChevronRight, Copy, Scissors, Trash2 } from "lucide-react";
import {
  clipDuration,
  defaultText,
  formatTime,
  locate,
  type ClipPatch,
  type EditOp,
} from "@/lib/video/ops";
import type { Clip, Media, Project } from "@/lib/video/types";
import { C } from "../theme";

const inputCls = "w-full rounded-md border px-2 py-1.5 text-sm bg-transparent outline-none focus:border-[#7c6dfa]";

export default function Inspector({
  project,
  clip,
  index,
  media,
  mediaById,
  time,
  apply,
  onSelect,
}: {
  project: Project;
  clip: Clip | null;
  index: number;
  media: Media[];
  mediaById: Record<string, Media>;
  time: number;
  apply: (ops: EditOp[], coalesceKey?: string) => boolean;
  onSelect: (id: string | null, jump?: boolean) => void;
}) {
  if (!clip) {
    return (
      <div className="text-sm space-y-3" style={{ color: C.muted }}>
        <p>타임라인에서 클립을 선택하면 그 부분만 따로 수정할 수 있어요.</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>시작/끝 트림, 속도, 볼륨, 페이드</li>
          <li>자막(텍스트) 추가·수정</li>
          <li>다른 영상으로 교체 (새로 만든 영상으로 장면 바꾸기)</li>
          <li>재생 위치에서 자르기, 복제, 순서 변경, 삭제</li>
        </ul>
      </div>
    );
  }

  const src = mediaById[clip.mediaId];
  const update = (patch: ClipPatch, key?: string) =>
    apply([{ op: "update_clip", clipId: clip.id, patch }], key && `${clip.id}:${key}`);

  // Source time under the playhead, if the playhead is inside this clip.
  const loc = locate(project, time);
  const playheadSrc =
    loc && loc.index === index ? clip.start + loc.offset * clip.speed : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-semibold">
          클립 #{index + 1}{" "}
          <span className="text-xs font-normal" style={{ color: C.muted }}>
            {formatTime(clipDuration(clip))}
          </span>
        </div>
        <div className="flex gap-1">
          <Btn title="앞으로" onClick={() => apply([{ op: "move_clip", clipId: clip.id, toIndex: index - 1 }])} disabled={index === 0}>
            <ChevronLeft size={14} />
          </Btn>
          <Btn title="뒤로" onClick={() => apply([{ op: "move_clip", clipId: clip.id, toIndex: index + 1 }])} disabled={index === project.clips.length - 1}>
            <ChevronRight size={14} />
          </Btn>
          <Btn
            title="재생 위치에서 자르기"
            disabled={playheadSrc === null}
            onClick={() => playheadSrc !== null && apply([{ op: "split_clip", clipId: clip.id, at: playheadSrc }])}
          >
            <Scissors size={14} />
          </Btn>
          <Btn title="복제" onClick={() => apply([{ op: "duplicate_clip", clipId: clip.id }])}>
            <Copy size={14} />
          </Btn>
          <Btn
            title="삭제"
            onClick={() => {
              apply([{ op: "delete_clip", clipId: clip.id }]);
              onSelect(null);
            }}
          >
            <Trash2 size={14} />
          </Btn>
        </div>
      </div>

      <Field label="메모 (AI가 참고해요)">
        <input
          className={inputCls}
          style={{ borderColor: C.border }}
          value={clip.label}
          placeholder="예: 인트로, 제품 소개"
          onChange={(e) => update({ label: e.target.value }, "label")}
        />
      </Field>

      <Section title="구간 (원본 기준 초)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="시작">
            <NumberInput value={clip.start} step={0.1} onChange={(v) => update({ start: v }, "start")} />
          </Field>
          <Field label="끝">
            <NumberInput value={clip.end} step={0.1} onChange={(v) => update({ end: v }, "end")} />
          </Field>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            className="underline disabled:opacity-40"
            disabled={playheadSrc === null}
            onClick={() => playheadSrc !== null && update({ start: playheadSrc })}
          >
            재생 위치를 시작으로
          </button>
          <button
            className="underline disabled:opacity-40"
            disabled={playheadSrc === null}
            onClick={() => playheadSrc !== null && update({ end: playheadSrc })}
          >
            재생 위치를 끝으로
          </button>
        </div>
        {src && (
          <p className="text-xs" style={{ color: C.muted }}>
            원본: {src.name} ({formatTime(src.duration)})
          </p>
        )}
      </Section>

      <Section title="속도 · 소리 · 전환">
        <Field label={`속도 ${clip.speed}x`}>
          <div className="flex flex-wrap gap-1">
            {[0.5, 0.75, 1, 1.25, 1.5, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => update({ speed: s })}
                className="px-2 py-1 rounded text-xs border"
                style={{
                  borderColor: C.border,
                  backgroundColor: clip.speed === s ? C.accent : undefined,
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </Field>
        <Field label={`볼륨 ${Math.round(clip.volume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={clip.volume}
            onChange={(e) => update({ volume: Number(e.target.value) }, "volume")}
            className="w-full"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="페이드 인 (초)">
            <NumberInput value={clip.fadeIn} step={0.1} onChange={(v) => update({ fadeIn: v }, "fadeIn")} />
          </Field>
          <Field label="페이드 아웃 (초)">
            <NumberInput value={clip.fadeOut} step={0.1} onChange={(v) => update({ fadeOut: v }, "fadeOut")} />
          </Field>
        </div>
      </Section>

      <Section title="화면 맞춤">
        <div className="grid grid-cols-2 gap-1">
          {(
            [
              ["cover", "꽉 채우기", "가장자리를 잘라 화면을 채움"],
              ["contain", "전체 보이기", "잘리지 않게, 남는 곳은 검은 여백"],
            ] as const
          ).map(([fit, label, hint]) => (
            <button
              key={fit}
              title={hint}
              onClick={() => update({ fit })}
              className="px-2 py-1.5 rounded text-xs border"
              style={{
                borderColor: C.border,
                backgroundColor: (clip.fit ?? "contain") === fit ? C.accent : undefined,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="자막 / 텍스트">
        {clip.text ? (
          <>
            <textarea
              className={inputCls}
              style={{ borderColor: C.border }}
              rows={2}
              value={clip.text.content}
              onChange={(e) => update({ text: { ...clip.text!, content: e.target.value } }, "text")}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field label="위치">
                <select
                  className={inputCls}
                  style={{ borderColor: C.border, backgroundColor: C.panel }}
                  value={clip.text.position}
                  onChange={(e) =>
                    update({ text: { ...clip.text!, position: e.target.value as "top" | "center" | "bottom" } })
                  }
                >
                  <option value="top">위</option>
                  <option value="center">가운데</option>
                  <option value="bottom">아래</option>
                </select>
              </Field>
              <Field label="크기">
                <NumberInput
                  value={clip.text.size}
                  step={2}
                  onChange={(v) => update({ text: { ...clip.text!, size: v } }, "textSize")}
                />
              </Field>
              <Field label="색">
                <input
                  type="color"
                  className="w-full h-8 rounded bg-transparent"
                  value={clip.text.color}
                  onChange={(e) => update({ text: { ...clip.text!, color: e.target.value } }, "textColor")}
                />
              </Field>
            </div>
            <div className="flex justify-between text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={clip.text.background}
                  onChange={(e) => update({ text: { ...clip.text!, background: e.target.checked } })}
                />
                배경 박스
              </label>
              <button className="underline text-red-300" onClick={() => update({ text: null })}>
                텍스트 삭제
              </button>
            </div>
          </>
        ) : (
          <button
            className="w-full rounded-md border border-dashed py-2 text-xs"
            style={{ borderColor: C.border }}
            onClick={() => update({ text: defaultText("자막을 입력하세요", project) })}
          >
            + 텍스트 추가
          </button>
        )}
      </Section>

      <Section title="영상 교체">
        <p className="text-xs" style={{ color: C.muted }}>
          이 클립의 화면만 다른 영상으로 바꿉니다. 자막·속도·페이드는 유지돼요.
        </p>
        <select
          className={inputCls}
          style={{ borderColor: C.border, backgroundColor: C.panel }}
          value=""
          onChange={(e) => {
            const m = mediaById[e.target.value];
            if (!m) return;
            const len = Math.min(clip.end - clip.start, m.duration);
            apply([{ op: "replace_media", clipId: clip.id, mediaId: m.id, start: 0, end: len }]);
          }}
        >
          <option value="">교체할 영상 선택…</option>
          {media
            .filter((m) => m.id !== clip.mediaId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({formatTime(m.duration)})
              </option>
            ))}
        </select>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t pt-3" style={{ borderColor: C.border }}>
      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.teal }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs" style={{ color: C.muted }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      className={inputCls}
      style={{ borderColor: C.border }}
      value={Number(value.toFixed(2))}
      step={step}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

function Btn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded border disabled:opacity-40"
      style={{ borderColor: C.border }}
    >
      {children}
    </button>
  );
}
