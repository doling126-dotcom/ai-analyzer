import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AI_SYSTEM_PROMPT = `You are an expert AI image analyst. When given an image, analyze it and determine which AI image generation tool likely created it, suggest reproduction prompts, and provide a confidence score.

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "estimatedTools": ["tool1", "tool2"],
  "primaryTool": "tool name",
  "confidence": 85,
  "styleKeywords": ["keyword1", "keyword2", "keyword3"],
  "promptCandidates": [
    {
      "prompt": "detailed prompt text here",
      "confidence": 90,
      "explanation": "why this prompt might work"
    },
    {
      "prompt": "second prompt variation",
      "confidence": 75,
      "explanation": "reasoning for this variation"
    },
    {
      "prompt": "third prompt variation",
      "confidence": 60,
      "explanation": "alternative approach"
    }
  ],
  "analysisReason": "detailed explanation of visual characteristics that led to these conclusions",
  "characteristics": ["characteristic1", "characteristic2", "characteristic3"]
}

Known AI tools to consider: Midjourney, DALL-E 3, DALL-E 2, Stable Diffusion, Stable Diffusion XL, Flux, Flux Schnell, Ideogram, Adobe Firefly, Leonardo AI, Playground AI, Bing Image Creator, Canva AI.`;

const PHOTO_SYSTEM_PROMPT = `You are an expert commercial photographer and lighting technician. Analyze the provided photograph for composition and lighting details to help photographers recreate similar shots.

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "composition": {
    "technique": "rule of thirds / golden ratio / centered / leading lines / etc",
    "subjectPosition": "description of where subject is placed",
    "leadingLines": "description of any leading lines present or null",
    "depth": "description of foreground/midground/background elements",
    "framing": "description of natural or artificial framing elements",
    "aspectRatio": "estimated aspect ratio and crop",
    "details": "additional composition observations"
  },
  "lighting": {
    "keyLightDirection": "front / side / back / top / bottom / 45-degree etc",
    "keyLightAngle": "estimated angle in degrees",
    "numberOfLights": 2,
    "lightQuality": "soft / hard / mixed",
    "softness": 70,
    "lightRatio": "3:1 / 2:1 / 4:1 etc",
    "colorTemperature": "3200K warm / 5600K daylight / 6500K cool etc",
    "colorTemperatureK": 5600,
    "shadowDetail": "deep shadows / open shadows / fill light present",
    "specialEffects": "rim light / hair light / background light / gobo / gel etc or null"
  },
  "reproductionGuide": [
    {
      "step": 1,
      "title": "Camera Setup",
      "description": "detailed instruction"
    },
    {
      "step": 2,
      "title": "Lighting Setup",
      "description": "detailed instruction"
    },
    {
      "step": 3,
      "title": "Key Light Position",
      "description": "detailed instruction"
    },
    {
      "step": 4,
      "title": "Fill Light / Reflector",
      "description": "detailed instruction"
    },
    {
      "step": 5,
      "title": "Background Setup",
      "description": "detailed instruction"
    },
    {
      "step": 6,
      "title": "Final Adjustments",
      "description": "detailed instruction"
    }
  ],
  "suggestedSettings": {
    "aperture": "f/2.8 - f/8",
    "shutterSpeed": "1/125s - 1/250s",
    "iso": "100-400",
    "focalLength": "50mm - 85mm equivalent"
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, mimeType, mode } = body as {
      image: string;
      mimeType: string;
      mode: "ai" | "photo";
    };

    if (!image || !mimeType || !mode) {
      return NextResponse.json(
        { error: "Missing required fields: image, mimeType, mode" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const systemPrompt =
      mode === "ai" ? AI_SYSTEM_PROMPT : PHOTO_SYSTEM_PROMPT;

    const userMessage =
      mode === "ai"
        ? "Analyze this image and determine which AI tool created it. Provide prompt candidates and confidence scores. Respond in JSON only."
        : "Analyze the composition and lighting of this photograph. Provide detailed technical analysis and reproduction guide. Respond in JSON only.";

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as
                  | "image/jpeg"
                  | "image/png"
                  | "image/gif"
                  | "image/webp",
                data: image,
              },
            },
            {
              type: "text",
              text: userMessage,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "No text response from Claude" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      const rawText = textContent.text.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        {
          error: "Failed to parse Claude response as JSON",
          rawResponse: textContent.text,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: parsed, mode });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    );
  }
}
