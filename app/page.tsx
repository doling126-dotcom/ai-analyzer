"use client";

import { useState } from "react";
import { Cpu, Camera, Loader2, AlertCircle, Wand2 } from "lucide-react";
import ImageUploader from "./components/ImageUploader";
import AiAnalysisResult from "./components/AiAnalysisResult";
import PhotoAnalysisResult from "./components/PhotoAnalysisResult";

type Mode = "ai" | "photo";

interface AnalysisState {
  loading: boolean;
  error: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any | null;
  mode: Mode | null;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Mode>("ai");
  const [imageData, setImageData] = useState<{
    base64: string;
    mimeType: string;
    file: File;
  } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({
    loading: false,
    error: null,
    result: null,
    mode: null,
  });

  const handleImageSelect = (base64: string, mimeType: string, file: File) => {
    setImageData({ base64, mimeType, file });
    setAnalysis({ loading: false, error: null, result: null, mode: null });
  };

  const handleClear = () => {
    setImageData(null);
    setAnalysis({ loading: false, error: null, result: null, mode: null });
  };

  const handleAnalyze = async () => {
    if (!imageData) return;

    setAnalysis({ loading: true, error: null, result: null, mode: activeTab });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData.base64,
          mimeType: imageData.mimeType,
          mode: activeTab,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysis({
        loading: false,
        error: null,
        result: data.result,
        mode: activeTab,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      setAnalysis({
        loading: false,
        error: message,
        result: null,
        mode: activeTab,
      });
    }
  };

  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    {
      id: "ai",
      label: "AI Image Analysis",
      icon: <Cpu size={15} />,
    },
    {
      id: "photo",
      label: "Photo Lighting Analysis",
      icon: <Camera size={15} />,
    },
  ];

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#0a0a0f", fontFamily: "system-ui, sans-serif" }}
    >
      {/* Header */}
      <header
        className="border-b sticky top-0 z-50 backdrop-blur-md"
        style={{
          borderColor: "#1e1e2e",
          backgroundColor: "rgba(10,10,15,0.85)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-xl"
              style={{ backgroundColor: "#7c6dfa22" }}
            >
              <Wand2 size={20} style={{ color: "#7c6dfa" }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                AI Analyzer
              </h1>
              <p className="text-xs" style={{ color: "#6b7280" }}>
                Powered by Claude Vision
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Tabs */}
        <div
          className="flex p-1 rounded-xl gap-1"
          style={{ backgroundColor: "#12121a" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setAnalysis({
                  loading: false,
                  error: null,
                  result: null,
                  mode: null,
                });
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
              style={
                activeTab === tab.id
                  ? {
                      backgroundColor: "#7c6dfa",
                      color: "#ffffff",
                    }
                  : {
                      color: "#9ca3af",
                    }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Upload Section */}
        <div
          className="rounded-xl border p-6"
          style={{ backgroundColor: "#12121a", borderColor: "#2a2a3a" }}
        >
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
            {activeTab === "ai"
              ? "Upload AI-Generated Image"
              : "Upload Commercial Photo"}
          </h2>
          <ImageUploader
            onImageSelect={handleImageSelect}
            selectedFile={imageData?.file ?? null}
            onClear={handleClear}
          />

          {imageData && (
            <button
              onClick={handleAnalyze}
              disabled={analysis.loading}
              className="w-full mt-4 py-3 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#7c6dfa",
                color: "#ffffff",
              }}
            >
              {analysis.loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing with Claude Vision...
                </>
              ) : (
                <>
                  {activeTab === "ai" ? (
                    <Cpu size={16} />
                  ) : (
                    <Camera size={16} />
                  )}
                  {activeTab === "ai"
                    ? "Analyze AI Tool & Prompts"
                    : "Analyze Lighting & Composition"}
                </>
              )}
            </button>
          )}
        </div>

        {/* Error State */}
        {analysis.error && (
          <div
            className="flex items-start gap-3 rounded-xl p-4 border"
            style={{
              backgroundColor: "rgba(239,68,68,0.05)",
              borderColor: "rgba(239,68,68,0.3)",
            }}
          >
            <AlertCircle
              size={18}
              className="shrink-0 mt-0.5"
              style={{ color: "#f87171" }}
            />
            <div>
              <p
                className="text-sm font-medium"
                style={{ color: "#fca5a5" }}
              >
                Analysis Failed
              </p>
              <p className="text-sm mt-0.5" style={{ color: "#f87171" }}>
                {analysis.error}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {analysis.loading && (
          <div
            className="rounded-xl border p-8 flex flex-col items-center gap-4"
            style={{ backgroundColor: "#12121a", borderColor: "#2a2a3a" }}
          >
            <div
              className="p-4 rounded-full"
              style={{ backgroundColor: "#7c6dfa22" }}
            >
              <Loader2
                size={32}
                className="animate-spin"
                style={{ color: "#7c6dfa" }}
              />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-200">
                Claude Vision is analyzing your image...
              </p>
              <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
                This may take 10-20 seconds
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {analysis.result && !analysis.loading && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-px flex-1"
                style={{ backgroundColor: "#2a2a3a" }}
              />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#4fd1c5" }}
              >
                Analysis Results
              </span>
              <div
                className="h-px flex-1"
                style={{ backgroundColor: "#2a2a3a" }}
              />
            </div>
            {analysis.mode === "ai" ? (
              <AiAnalysisResult data={analysis.result} />
            ) : (
              <PhotoAnalysisResult data={analysis.result} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="border-t mt-16 py-6 text-center"
        style={{ borderColor: "#1e1e2e" }}
      >
        <p className="text-xs" style={{ color: "#4b5563" }}>
          AI Analyzer &mdash; Built with Next.js &amp; Claude Vision API
        </p>
      </footer>
    </div>
  );
}
