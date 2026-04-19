"use client";

import { useState } from "react";
import {
  Camera,
  Sun,
  Layers,
  Thermometer,
  Zap,
  CheckCircle,
  Circle,
  Compass,
  Lightbulb,
} from "lucide-react";

interface CompositionData {
  technique: string;
  subjectPosition: string;
  leadingLines: string | null;
  depth: string;
  framing: string;
  aspectRatio: string;
  details: string;
}

interface LightingData {
  keyLightDirection: string;
  keyLightAngle: number;
  numberOfLights: number;
  lightQuality: string;
  softness: number;
  lightRatio: string;
  colorTemperature: string;
  colorTemperatureK: number;
  shadowDetail: string;
  specialEffects: string | null;
}

interface ReproductionStep {
  step: number;
  title: string;
  description: string;
}

interface SuggestedSettings {
  aperture: string;
  shutterSpeed: string;
  iso: string;
  focalLength: string;
}

interface PhotoAnalysisData {
  composition: CompositionData;
  lighting: LightingData;
  reproductionGuide: ReproductionStep[];
  suggestedSettings: SuggestedSettings;
}

interface PhotoAnalysisResultProps {
  data: PhotoAnalysisData;
}

function SoftHardGauge({ value }: { value: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Hard</span>
        <span>Soft</span>
      </div>
      <div className="relative h-3 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(to right, #f59e0b, #7c6dfa, #4fd1c5)`,
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-[#7c6dfa] shadow-lg"
          style={{ left: `calc(${value}% - 6px)` }}
        />
      </div>
      <p className="text-center text-xs text-gray-400 mt-1">
        {value >= 70 ? "Soft" : value >= 40 ? "Mixed" : "Hard"} ({value}%)
      </p>
    </div>
  );
}

function CompassDirection({ direction }: { direction: string }) {
  const dirMap: Record<string, number> = {
    front: 0,
    top: 0,
    back: 180,
    left: 270,
    right: 90,
    "front-left": 315,
    "front-right": 45,
    "back-left": 225,
    "back-right": 135,
    side: 90,
    "45-degree": 45,
  };

  const normalized = direction.toLowerCase().replace(/\s+/g, "-");
  let angle = 0;
  for (const [key, val] of Object.entries(dirMap)) {
    if (normalized.includes(key)) {
      angle = val;
      break;
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 mt-2">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-[#2a2a3a] bg-[#0a0a0f]" />
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-xs text-gray-500">
          N
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-gray-500">
          S
        </div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          W
        </div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          E
        </div>
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="w-0.5 h-6 bg-[#7c6dfa] rounded-full origin-bottom" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#7c6dfa]" />
        </div>
      </div>
      <p className="text-xs text-gray-300 text-center capitalize">{direction}</p>
    </div>
  );
}

function ColorTempBadge({ kelvin, label }: { kelvin: number; label: string }) {
  let color = "#fbbf24";
  if (kelvin > 5000) color = "#93c5fd";
  else if (kelvin > 4000) color = "#d1fae5";

  return (
    <div className="flex items-center gap-2 mt-2">
      <div
        className="w-8 h-8 rounded-full border-2 border-[#2a2a3a] shrink-0"
        style={{ backgroundColor: color + "80" }}
      />
      <div>
        <p className="text-sm font-medium text-gray-200">{kelvin}K</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#7c6dfa]">{icon}</span>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

export default function PhotoAnalysisResult({ data }: PhotoAnalysisResultProps) {
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (step: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const { composition, lighting, reproductionGuide, suggestedSettings } = data;

  return (
    <div className="space-y-5">
      {/* Composition */}
      <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Camera size={16} className="text-[#4fd1c5]" />
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
            Composition Analysis
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoCard icon={<Layers size={14} />} title="Technique">
            <p className="text-gray-200 text-sm font-medium">{composition.technique}</p>
          </InfoCard>
          <InfoCard icon={<Compass size={14} />} title="Subject Position">
            <p className="text-gray-200 text-sm">{composition.subjectPosition}</p>
          </InfoCard>
          {composition.leadingLines && (
            <InfoCard icon={<Zap size={14} />} title="Leading Lines">
              <p className="text-gray-200 text-sm">{composition.leadingLines}</p>
            </InfoCard>
          )}
          <InfoCard icon={<Layers size={14} />} title="Depth">
            <p className="text-gray-200 text-sm">{composition.depth}</p>
          </InfoCard>
          {composition.framing && (
            <InfoCard icon={<Camera size={14} />} title="Framing">
              <p className="text-gray-200 text-sm">{composition.framing}</p>
            </InfoCard>
          )}
          <InfoCard icon={<Camera size={14} />} title="Aspect Ratio">
            <p className="text-gray-200 text-sm">{composition.aspectRatio}</p>
          </InfoCard>
        </div>
        {composition.details && (
          <p className="text-gray-400 text-xs mt-3 leading-relaxed">
            {composition.details}
          </p>
        )}
      </div>

      {/* Lighting */}
      <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sun size={16} className="text-[#7c6dfa]" />
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
            Lighting Analysis
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Key Light Direction */}
          <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4 col-span-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Key Light Direction
            </p>
            <CompassDirection direction={lighting.keyLightDirection} />
          </div>

          {/* Number of Lights */}
          <InfoCard icon={<Lightbulb size={14} />} title="Light Sources">
            <div className="flex items-center gap-2 mt-2">
              <span className="text-3xl font-bold text-[#4fd1c5]">
                {lighting.numberOfLights}
              </span>
              <span className="text-gray-400 text-sm">
                {lighting.numberOfLights === 1 ? "light" : "lights"}
              </span>
            </div>
          </InfoCard>

          {/* Light Ratio */}
          <InfoCard icon={<Sun size={14} />} title="Light Ratio">
            <p className="text-2xl font-bold text-[#7c6dfa] mt-2">
              {lighting.lightRatio}
            </p>
            <p className="text-xs text-gray-500">key : fill</p>
          </InfoCard>

          {/* Color Temperature */}
          <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Thermometer size={14} className="text-[#7c6dfa]" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Color Temperature
              </p>
            </div>
            <ColorTempBadge
              kelvin={lighting.colorTemperatureK}
              label={lighting.colorTemperature}
            />
          </div>

          {/* Shadow Detail */}
          <InfoCard icon={<Layers size={14} />} title="Shadow Detail">
            <p className="text-gray-200 text-sm mt-1">{lighting.shadowDetail}</p>
          </InfoCard>

          {/* Special Effects */}
          <InfoCard icon={<Zap size={14} />} title="Special Effects">
            <p className="text-gray-200 text-sm mt-1">
              {lighting.specialEffects ?? "None"}
            </p>
          </InfoCard>
        </div>

        {/* Light Quality Gauge */}
        <div className="mt-4 bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Light Quality
          </p>
          <SoftHardGauge value={lighting.softness} />
        </div>
      </div>

      {/* Camera Settings */}
      {suggestedSettings && (
        <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Camera size={16} className="text-[#4fd1c5]" />
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Suggested Camera Settings
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Aperture", value: suggestedSettings.aperture },
              { label: "Shutter Speed", value: suggestedSettings.shutterSpeed },
              { label: "ISO", value: suggestedSettings.iso },
              { label: "Focal Length", value: suggestedSettings.focalLength },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-lg p-3 text-center"
              >
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-sm font-semibold text-[#4fd1c5]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reproduction Guide */}
      {reproductionGuide?.length > 0 && (
        <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={16} className="text-[#4fd1c5]" />
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
              Reproduction Guide
            </h3>
            <span className="ml-auto text-xs text-gray-500">
              {checkedSteps.size}/{reproductionGuide.length} steps
            </span>
          </div>
          <div className="space-y-2">
            {reproductionGuide.map((item) => (
              <button
                key={item.step}
                onClick={() => toggleStep(item.step)}
                className={`w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                  checkedSteps.has(item.step)
                    ? "bg-[#4fd1c5]/5 border-[#4fd1c5]/30"
                    : "bg-[#0a0a0f] border-[#2a2a3a] hover:border-[#7c6dfa]/30"
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {checkedSteps.has(item.step) ? (
                    <CheckCircle size={18} className="text-[#4fd1c5]" />
                  ) : (
                    <Circle size={18} className="text-gray-600" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-[#7c6dfa]">
                      Step {item.step}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        checkedSteps.has(item.step)
                          ? "text-[#4fd1c5] line-through opacity-60"
                          : "text-gray-200"
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
