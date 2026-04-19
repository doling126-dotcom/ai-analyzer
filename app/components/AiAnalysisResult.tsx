"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface PromptCandidate {
  prompt: string;
  confidence: number;
  explanation: string;
}

interface AiAnalysisData {
  estimatedTools: string[];
  primaryTool: string;
  confidence: number;
  styleKeywords: string[];
  promptCandidates: PromptCandidate[];
  analysisReason: string;
  characteristics: string[];
}

interface AiAnalysisResultProps {
  data: AiAnalysisData;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[#1e1e2e] hover:bg-[#7c6dfa]/20 text-gray-400 hover:text-[#7c6dfa] border border-[#2a2a3a] hover:border-[#7c6dfa]/50 transition-all"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const color =
    value >= 75 ? "#4fd1c5" : value >= 50 ? "#7c6dfa" : "#f59e0b";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{label}</span>
          <span style={{ color }}>{value}%</span>
        </div>
      )}
      <div className="h-2 w-full bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const TOOL_COLORS: Record<string, string> = {
  Midjourney: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "DALL-E 3": "bg-green-500/20 text-green-300 border-green-500/30",
  "DALL-E 2": "bg-green-500/20 text-green-300 border-green-500/30",
  "Stable Diffusion": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Stable Diffusion XL": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Flux: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Flux Schnell": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Ideogram: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Adobe Firefly": "bg-red-500/20 text-red-300 border-red-500/30",
  "Leonardo AI": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

function getToolColor(tool: string) {
  return TOOL_COLORS[tool] ?? "bg-[#7c6dfa]/20 text-[#7c6dfa] border-[#7c6dfa]/30";
}

export default function AiAnalysisResult({ data }: AiAnalysisResultProps) {
  const [expandedPrompt, setExpandedPrompt] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {/* Estimated Tools */}
      <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-[#7c6dfa]" />
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
            Estimated AI Tool
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {data.estimatedTools.map((tool) => (
            <span
              key={tool}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getToolColor(tool)} ${
                tool === data.primaryTool ? "ring-1 ring-current" : ""
              }`}
            >
              {tool}
              {tool === data.primaryTool && (
                <span className="ml-1.5 text-xs opacity-70">(primary)</span>
              )}
            </span>
          ))}
        </div>
        <ConfidenceBar value={data.confidence} label="Overall Confidence" />
      </div>

      {/* Style Keywords */}
      {data.styleKeywords?.length > 0 && (
        <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-3">
            Style Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.styleKeywords.map((kw) => (
              <span
                key={kw}
                className="px-2.5 py-1 bg-[#1e1e2e] text-[#4fd1c5] text-xs rounded-lg border border-[#4fd1c5]/20"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Candidates */}
      <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-4">
          Reproduction Prompt Candidates
        </h3>
        <div className="space-y-3">
          {data.promptCandidates?.map((candidate, idx) => (
            <div
              key={idx}
              className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="text-xs font-bold text-[#7c6dfa] uppercase tracking-wider">
                    Candidate {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {candidate.confidence}% match
                    </span>
                    <CopyButton text={candidate.prompt} />
                  </div>
                </div>
                <div className="mb-3">
                  <ConfidenceBar value={candidate.confidence} />
                </div>
                <p className="text-gray-200 text-sm leading-relaxed font-mono bg-[#12121a] rounded-lg p-3 border border-[#2a2a3a]">
                  {candidate.prompt}
                </p>
                {candidate.explanation && (
                  <button
                    onClick={() =>
                      setExpandedPrompt(expandedPrompt === idx ? null : idx)
                    }
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 mt-2 transition-colors"
                  >
                    {expandedPrompt === idx ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                    {expandedPrompt === idx ? "Hide" : "Show"} reasoning
                  </button>
                )}
                {expandedPrompt === idx && (
                  <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                    {candidate.explanation}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analysis Reason */}
      {data.analysisReason && (
        <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider mb-3">
            Visual Characteristics & Analysis
          </h3>
          {data.characteristics?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {data.characteristics.map((c) => (
                <span
                  key={c}
                  className="text-xs px-2 py-0.5 bg-[#1e1e2e] text-gray-300 rounded border border-[#2a2a3a]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          <p className="text-gray-400 text-sm leading-relaxed">{data.analysisReason}</p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <p className="text-amber-200/80 text-xs leading-relaxed">
          <span className="font-semibold text-amber-300">Disclaimer:</span> This
          is an AI-powered estimation, not a definitive identification. The
          prompts provided are reconstructed candidates based on visual analysis
          and are NOT the original prompts used to generate the image. Results
          may vary and should be treated as educated guesses only.
        </p>
      </div>
    </div>
  );
}
