"use client";

import { useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import type { EditOp } from "@/lib/video/ops";
import type { Project } from "@/lib/video/types";
import { C } from "../theme";

interface Message {
  role: "user" | "assistant";
  text: string;
  ops?: number;
  error?: boolean;
}

const EXAMPLES = [
  "선택한 클립에 '오늘의 꿀팁' 자막 넣어줘",
  "3번 클립을 1.5배속으로 바꾸고 앞 0.5초 잘라줘",
  "모든 클립 사이에 0.2초 페이드 넣어줘",
  "제일 어두운 장면 클립은 삭제해줘",
  "마지막 클립을 맨 앞으로 옮겨줘",
];

export default function AiPanel({
  project,
  selectedId,
  apply,
}: {
  project: Project;
  selectedId: string | null;
  apply: (ops: EditOp[]) => boolean;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeFrames, setIncludeFrames] = useState(true);

  const send = async (instruction: string) => {
    if (!instruction.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: instruction }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/video/projects/${project.id}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          instruction,
          selectedClipIds: selectedId ? [selectedId] : [],
          includeFrames,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 편집 실패");
      const ok = data.ops.length > 0 && apply(data.ops);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.summary, ops: ok ? data.ops.length : 0 },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: err instanceof Error ? err.message : String(err), error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 text-sm">
      <p className="text-xs" style={{ color: C.muted }}>
        원하는 수정을 말로 적으면 Claude가 해당 클립만 바꿉니다. 결과가 마음에 안 들면
        Ctrl+Z로 되돌리세요.
      </p>

      <div className="flex-1 space-y-2 overflow-y-auto min-h-24">
        {messages.length === 0 && (
          <div className="space-y-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setInput(ex)}
                className="block w-full text-left text-xs rounded-md border px-2 py-1.5 hover:opacity-80"
                style={{ borderColor: C.border, color: "#c4c4d4" }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className="rounded-lg px-3 py-2 whitespace-pre-wrap"
            style={
              m.role === "user"
                ? { backgroundColor: "#7c6dfa33", marginLeft: 24 }
                : {
                    backgroundColor: m.error ? "rgba(239,68,68,0.1)" : "#1c1c28",
                    color: m.error ? "#fca5a5" : undefined,
                    marginRight: 24,
                  }
            }
          >
            {m.role === "assistant" && !m.error && (
              <Sparkles size={12} className="inline mr-1" style={{ color: C.teal }} />
            )}
            {m.text}
            {m.ops ? (
              <div className="text-[11px] mt-1" style={{ color: C.muted }}>
                편집 {m.ops}개 적용됨
              </div>
            ) : null}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
            <Loader2 size={12} className="animate-spin" /> Claude가 편집 중…
          </div>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
        <input type="checkbox" checked={includeFrames} onChange={(e) => setIncludeFrames(e.target.checked)} />
        장면 이미지도 보내기 (화면 내용을 보고 판단)
      </label>
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={2}
          placeholder="예: 2번 클립 자막을 '구독 좋아요'로 바꿔줘"
          className="flex-1 rounded-md border px-2 py-1.5 bg-transparent outline-none resize-none"
          style={{ borderColor: C.border }}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim() || project.clips.length === 0}
          className="px-3 rounded-md disabled:opacity-40"
          style={{ backgroundColor: C.accent }}
          aria-label="보내기"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
