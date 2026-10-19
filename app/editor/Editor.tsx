"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clapperboard,
  Loader2,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  SkipBack,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  applyOps,
  clipStartTime,
  formatTime,
  locate,
  projectDuration,
  type EditOp,
} from "@/lib/video/ops";
import type { Media, Project } from "@/lib/video/types";
import Preview from "./components/Preview";
import Timeline from "./components/Timeline";
import Inspector from "./components/Inspector";
import AiPanel from "./components/AiPanel";
import Library from "./components/Library";
import RenderPanel from "./components/RenderPanel";
import { C } from "./theme";


const PRESETS = [
  { label: "가로 16:9 (1920×1080)", width: 1920, height: 1080 },
  { label: "세로 9:16 쇼츠 (1080×1920)", width: 1080, height: 1920 },
  { label: "정사각 1:1 (1080×1080)", width: 1080, height: 1080 },
];

interface History {
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastAt: number;
}

export default function Editor() {
  const [media, setMedia] = useState<Media[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<History>({
    past: [],
    future: [],
    lastKey: null,
    lastAt: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [seekVersion, setSeekVersion] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<"clip" | "ai" | "render">("clip");
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");

  const mediaById = useMemo(
    () => Object.fromEntries(media.map((m) => [m.id, m])),
    [media]
  );
  const duration = project ? projectDuration(project) : 0;
  const selectedIndex = project?.clips.findIndex((c) => c.id === selectedId) ?? -1;

  const refreshMedia = useCallback(async () => {
    const res = await fetch("/api/video/media");
    const data = await res.json();
    setMedia(data.media ?? []);
  }, []);

  useEffect(() => {
    fetch("/api/video/media")
      .then((r) => r.json())
      .then((d) => setMedia(d.media ?? []))
      .catch(() => setError("미디어 목록을 불러오지 못했습니다"));
    fetch("/api/video/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  // --- Autosave ---------------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Project | null>(null);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const p = pendingSave.current;
    if (!p) return;
    pendingSave.current = null;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/video/projects/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: p }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaveState(pendingSave.current ? "dirty" : "saved");
    } catch (err) {
      setSaveState("dirty");
      setError(`저장 실패: ${err instanceof Error ? err.message : err}`);
    }
  }, []);

  const scheduleSave = useCallback(
    (p: Project) => {
      pendingSave.current = p;
      setSaveState("dirty");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushSave, 700);
    },
    [flushSave]
  );

  // --- Editing with undo/redo ------------------------------------------
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  /** Apply ops as one undoable step. Steps with the same coalesceKey within 1s merge. */
  const apply = useCallback(
    (ops: EditOp[], coalesceKey?: string): boolean => {
      const current = projectRef.current;
      if (!current || ops.length === 0) return false;
      let next: Project;
      try {
        next = applyOps(current, ops, mediaById);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
      const now = Date.now();
      setHistory((h) => {
        const merge = coalesceKey && h.lastKey === coalesceKey && now - h.lastAt < 1000;
        return {
          past: merge ? h.past : [...h.past.slice(-99), current],
          future: [],
          lastKey: coalesceKey ?? null,
          lastAt: now,
        };
      });
      projectRef.current = next;
      setProject(next);
      scheduleSave(next);
      setError(null);
      return true;
    },
    [mediaById, scheduleSave]
  );

  /** Show a change without recording history (used while dragging). */
  const preview = useCallback(
    (base: Project, ops: EditOp[]) => {
      try {
        const next = applyOps(base, ops, mediaById);
        projectRef.current = next;
        setProject(next);
      } catch {
        /* ignore invalid intermediate drag states */
      }
    },
    [mediaById]
  );

  /** Record a finished drag: `base` becomes the undo point. */
  const commitFrom = useCallback(
    (base: Project) => {
      const current = projectRef.current;
      if (!current || current === base) return;
      setHistory((h) => ({
        past: [...h.past.slice(-99), base],
        future: [],
        lastKey: null,
        lastAt: 0,
      }));
      scheduleSave(current);
    },
    [scheduleSave]
  );

  const restore = useCallback(
    (p: Project, h: History) => {
      projectRef.current = p;
      setProject(p);
      setHistory(h);
      scheduleSave(p);
    },
    [scheduleSave]
  );

  const undo = useCallback(() => {
    if (!project || !history.past.length) return;
    restore(history.past[history.past.length - 1], {
      past: history.past.slice(0, -1),
      future: [project, ...history.future],
      lastKey: null,
      lastAt: 0,
    });
  }, [project, history, restore]);

  const redo = useCallback(() => {
    if (!project || !history.future.length) return;
    const [next, ...rest] = history.future;
    restore(next, { past: [...history.past, project], future: rest, lastKey: null, lastAt: 0 });
  }, [project, history, restore]);

  // --- Playback ---------------------------------------------------------
  const seek = useCallback(
    (t: number) => {
      setTime(Math.max(0, Math.min(t, duration)));
      setSeekVersion((v) => v + 1);
    },
    [duration]
  );

  const selectClip = useCallback(
    (id: string | null, jump = true) => {
      setSelectedId(id);
      const p = projectRef.current;
      if (id && p && jump) {
        const i = p.clips.findIndex((c) => c.id === id);
        if (i >= 0) seek(clipStartTime(p, i));
      }
      if (id) setTab((t) => (t === "render" ? "clip" : t));
    },
    [seek]
  );

  const splitAtPlayhead = useCallback(() => {
    const p = projectRef.current;
    if (!p) return;
    const loc = locate(p, time);
    if (!loc) return;
    const clip = p.clips[loc.index];
    apply([{ op: "split_clip", clipId: clip.id, at: clip.start + loc.offset * clip.speed }]);
  }, [apply, time]);

  const deleteSelected = useCallback(() => {
    if (selectedId) {
      apply([{ op: "delete_clip", clipId: selectedId }]);
      setSelectedId(null);
    }
  }, [apply, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === "s" && !mod) {
        splitAtPlayhead();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, splitAtPlayhead, deleteSelected]);

  // --- Projects ---------------------------------------------------------
  const openProject = (p: Project) => {
    projectRef.current = p;
    setProject(p);
    setHistory({ past: [], future: [], lastKey: null, lastAt: 0 });
    setSelectedId(null);
    setTime(0);
    setSeekVersion((v) => v + 1);
    setPlaying(false);
  };

  const createProject = async (preset: (typeof PRESETS)[number]) => {
    const res = await fetch("/api/video/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `프로젝트 ${new Date().toLocaleString("ko-KR")}`,
        width: preset.width,
        height: preset.height,
        mediaIds: [],
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setProjects((ps) => [data.project, ...ps]);
    openProject(data.project);
  };

  const closeProject = async () => {
    await flushSave();
    const res = await fetch("/api/video/projects");
    setProjects((await res.json()).projects ?? []);
    setProject(null);
    setPlaying(false);
  };

  // --- Render -----------------------------------------------------------
  if (!project) {
    return (
      <Shell>
        <div className="max-w-3xl mx-auto w-full px-4 py-10 space-y-8">
          <section className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: C.panel, borderColor: C.border }}>
            <h2 className="font-semibold">새 프로젝트</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => createProject(p)}
                  className="rounded-lg border px-3 py-3 text-sm flex items-center gap-2 hover:opacity-90"
                  style={{ borderColor: C.border }}
                >
                  <Plus size={14} style={{ color: C.accent }} /> {p.label}
                </button>
              ))}
            </div>
          </section>
          <section className="rounded-xl border p-6 space-y-3" style={{ backgroundColor: C.panel, borderColor: C.border }}>
            <h2 className="font-semibold">내 프로젝트</h2>
            {projects.length === 0 && (
              <p className="text-sm" style={{ color: C.muted }}>
                아직 프로젝트가 없습니다.
              </p>
            )}
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => openProject(p)}
                className="w-full text-left rounded-lg border px-4 py-3 flex justify-between items-center hover:opacity-90"
                style={{ borderColor: C.border }}
              >
                <span className="text-sm">{p.name}</span>
                <span className="text-xs" style={{ color: C.muted }}>
                  클립 {p.clips.length}개 · {formatTime(projectDuration(p))} · {p.width}×{p.height}
                </span>
              </button>
            ))}
          </section>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </Shell>
    );
  }

  const selected = selectedIndex >= 0 ? project.clips[selectedIndex] : null;

  return (
    <Shell
      title={
        <input
          value={project.name}
          onChange={(e) => {
            const next = { ...project, name: e.target.value };
            setProject(next);
            scheduleSave(next);
          }}
          className="bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-gray-500 min-w-0"
        />
      }
      right={
        <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
          {saveState === "saving" && <Loader2 size={12} className="animate-spin" />}
          {saveState === "saved" ? "저장됨" : saveState === "saving" ? "저장 중" : "변경됨"}
          <button onClick={closeProject} className="ml-3 underline">
            프로젝트 목록
          </button>
        </div>
      }
    >
      <div className="flex-1 grid gap-3 p-3 min-h-0 lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <Library
          media={media}
          onUploaded={refreshMedia}
          onError={setError}
          onAddClips={(ops) => apply(ops)}
          clipCount={project.clips.length}
        />

        <div className="flex flex-col gap-3 min-w-0">
          <Preview
            project={project}
            mediaById={mediaById}
            time={time}
            seekVersion={seekVersion}
            playing={playing}
            onTime={setTime}
            onEnded={() => setPlaying(false)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <IconButton title="처음으로" onClick={() => seek(0)}>
              <SkipBack size={16} />
            </IconButton>
            <IconButton
              title="재생/정지 (Space)"
              onClick={() => setPlaying((p) => !p)}
              disabled={project.clips.length === 0}
              accent
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </IconButton>
            <span className="text-xs tabular-nums" style={{ color: C.muted }}>
              {formatTime(time)} / {formatTime(duration)}
            </span>
            <div className="flex-1" />
            <IconButton title="재생 위치에서 자르기 (S)" onClick={splitAtPlayhead} disabled={!project.clips.length}>
              <Scissors size={16} />
            </IconButton>
            <IconButton title="선택 클립 삭제 (Delete)" onClick={deleteSelected} disabled={!selected}>
              <Trash2 size={16} />
            </IconButton>
            <IconButton title="실행 취소 (Ctrl+Z)" onClick={undo} disabled={!history.past.length}>
              <Undo2 size={16} />
            </IconButton>
            <IconButton title="다시 실행 (Ctrl+Shift+Z)" onClick={redo} disabled={!history.future.length}>
              <Redo2 size={16} />
            </IconButton>
          </div>
          {error && (
            <div className="text-xs rounded-lg px-3 py-2 flex justify-between" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>
              {error}
              <button onClick={() => setError(null)}>닫기</button>
            </div>
          )}
        </div>

        <div className="rounded-xl border flex flex-col min-h-0" style={{ backgroundColor: C.panel, borderColor: C.border }}>
          <div className="flex p-1 gap-1 border-b" style={{ borderColor: C.border }}>
            {(
              [
                ["clip", "클립 편집"],
                ["ai", "AI 편집"],
                ["render", "렌더링"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex-1 text-xs py-2 rounded-md font-medium"
                style={tab === id ? { backgroundColor: C.accent, color: "#fff" } : { color: "#9ca3af" }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {tab === "clip" && (
              <Inspector
                project={project}
                clip={selected}
                index={selectedIndex}
                media={media}
                mediaById={mediaById}
                time={time}
                apply={apply}
                onSelect={selectClip}
              />
            )}
            {tab === "ai" && (
              <AiPanel project={project} selectedId={selectedId} apply={apply} />
            )}
            {tab === "render" && <RenderPanel project={project} flushSave={flushSave} />}
          </div>
        </div>
      </div>

      <Timeline
        project={project}
        time={time}
        selectedId={selectedId}
        onSeek={(t) => {
          setPlaying(false);
          seek(t);
        }}
        onSelect={selectClip}
        apply={apply}
        preview={preview}
        commitFrom={commitFrom}
      />
    </Shell>
  );
}

function Shell({
  children,
  title,
  right,
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col text-white" style={{ backgroundColor: C.bg }}>
      <header className="border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: "#1e1e2e" }}>
        <Link href="/" title="홈" style={{ color: C.muted }}>
          <ArrowLeft size={16} />
        </Link>
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: "#7c6dfa22" }}>
          <Clapperboard size={16} style={{ color: C.accent }} />
        </div>
        <span className="font-bold text-sm shrink-0">AI 영상 편집기</span>
        {title}
        <div className="flex-1" />
        {right}
      </header>
      {children}
    </div>
  );
}

export function IconButton({
  children,
  title,
  onClick,
  disabled,
  accent,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-lg border disabled:opacity-40"
      style={{
        borderColor: C.border,
        backgroundColor: accent ? C.accent : C.panel,
      }}
    >
      {children}
    </button>
  );
}
