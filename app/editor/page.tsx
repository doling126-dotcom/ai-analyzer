import type { Metadata } from "next";
import Editor from "./Editor";

export const metadata: Metadata = {
  title: "AI 영상 편집기",
  description: "무음 자동 컷, 클립 단위 부분 수정, Claude 자연어 편집",
};

export default function EditorPage() {
  return <Editor />;
}
