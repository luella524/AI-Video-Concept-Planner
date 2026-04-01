import { NextResponse } from "next/server";

export type GenerateResponse = {
  summary: string;
  scenes: string[];
  prompts: string[];
  final_prompt: string;
  post_credit?: string;
};

function trimIdea(idea: string): string {
  const t = idea.trim();
  if (!t) return "your concept";
  return t.length > 280 ? `${t.slice(0, 277)}…` : t;
}

function extractJSONObject(input: string): string | null {
  const first = input.indexOf("{");
  if (first === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = first; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return input.slice(first, i + 1);
      }
    }
  }
  return null;
}

function normalizeResponseShape(
  value: unknown
): Omit<GenerateResponse, "post_credit"> | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const summary =
    typeof obj.summary === "string" ? obj.summary.trim() : "";
  const final_prompt =
    typeof obj.final_prompt === "string" ? obj.final_prompt.trim() : "";
  const scenes = Array.isArray(obj.scenes)
    ? obj.scenes.filter((x): x is string => typeof x === "string").map((s) => s.trim())
    : [];
  const prompts = Array.isArray(obj.prompts)
    ? obj.prompts.filter((x): x is string => typeof x === "string").map((p) => p.trim())
    : [];

  if (!summary || !final_prompt || scenes.length === 0 || prompts.length === 0) {
    return null;
  }

  return { summary, scenes, prompts, final_prompt };
}

/** Qwen and smaller models sometimes leak JSON keys or other fields into scene strings. */
function isGarbageSceneOrPromptLine(s: string): boolean {
  const t = s.trim();
  if (t.length < 25) return true;
  if (/final_prompt\s*["']?\s*:/i.test(t)) return true;
  if (/^["']?final_prompt["']?\s*:/i.test(t)) return true;
  if (/^prompts?\s*[:[\s'"`]/i.test(t)) return true;
  if (/^\[[\s\S]*\]$/.test(t) && t.length < 400) return true;
  return false;
}

function looksLikeModularFinalPrompt(s: string): boolean {
  return (
    s.includes("VIDEO CONCEPT:") &&
    s.includes("STYLE:") &&
    s.includes("STRUCTURE:")
  );
}

/** Canonical modular brief; used in prompts and as fallback when the model returns a one-liner. */
function buildCanonicalFinalPrompt(core: string): string {
  return `VIDEO CONCEPT:
"${core}"

STYLE:
Modern, minimal, high-end product film

STRUCTURE:
1. Hook — immediate visual tied to ambition and product thinking
2. Contrast — two visual chapters that build curiosity
3. Closing — one iconic, memorable frame

VISUAL LANGUAGE:
* Camera: slow, intentional, confident movements
* Lighting: soft key light with subtle edge contrast
* Color: restrained neutrals with one accent color
* Composition: clean, negative space, product-focused framing

AUDIO:
* Sparse piano or ambient bed
* One sharp percussive accent for transitions

TONE:
* No direct narration
* Let visuals communicate meaning
* Subtle, intelligent, confident

CONSTRAINTS:
* Avoid generic visuals
* Avoid stock aesthetics
* Focus on originality and clarity`;
}

/**
 * Keep only real scene beats; cap at 3. Drop leaked JSON / prompts rows.
 */
function sanitizeScenesAndPrompts(
  scenes: string[],
  prompts: string[]
): { scenes: string[]; prompts: string[] } | null {
  const scenesF = scenes.filter((s) => !isGarbageSceneOrPromptLine(s));
  const promptsF = prompts.filter((p) => !isGarbageSceneOrPromptLine(p));
  const sOut =
    scenesF.length >= 3 ? scenesF.slice(0, 3) : scenes.slice(0, 3);
  const pOut =
    promptsF.length >= 3 ? promptsF.slice(0, 3) : prompts.slice(0, 3);
  if (sOut.length < 3 || pOut.length < 3) return null;
  if (
    sOut.some((s) => isGarbageSceneOrPromptLine(s)) ||
    pOut.some((p) => isGarbageSceneOrPromptLine(p))
  ) {
    return null;
  }
  return { scenes: sOut, prompts: pOut };
}

async function generateWithTogether(
  idea: string
): Promise<Omit<GenerateResponse, "post_credit">> {
  const apiKey = process.env.TOGETHER_API_KEY;
  const model =
    process.env.TOGETHER_MODEL || "meta-llama/Llama-3.3-70B-Instruct-Turbo";
  if (!apiKey) {
    throw new Error("TOGETHER_API_KEY is missing");
  }
  const core = trimIdea(idea);
  const outputSchema = {
    type: "object",
    properties: {
      summary: { type: "string" },
      scenes: {
        type: "array",
        description:
          "Three prose scene beats for the user's idea: cold open, rising action, climax & tag — not section titles alone.",
        items: {
          type: "string",
          minLength: 80,
          description:
            "2–4 sentences: specific shots, mood, and story beat. Do not output only a section label.",
        },
        minItems: 3,
        maxItems: 3,
      },
      prompts: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      final_prompt: {
        type: "string",
        minLength: 280,
        description:
          "Full modular brief: must contain lines VIDEO CONCEPT:, STYLE:, STRUCTURE:, VISUAL LANGUAGE:, AUDIO:, TONE:, CONSTRAINTS:. Not a one-line ad or sentence.",
      },
    },
    required: ["summary", "scenes", "prompts", "final_prompt"],
    additionalProperties: false,
  } as const;

  const prompt = `You are an expert creative director for short cinematic AI videos.
Return ONLY valid JSON with this exact shape:
{
  "summary": "string",
  "scenes": ["string", "string", "string"],
  "prompts": ["string", "string", "string"],
  "final_prompt": "string"
}

Rules:
- Output MUST be valid JSON only. No markdown fences, no extra text.
- Never paste JSON key names like "final_prompt" or "prompts" inside any string value. Each field is separate in the JSON object.
- "final_prompt" must be the FULL multi-line modular template (starting with VIDEO CONCEPT:). Do not replace it with a single marketing sentence. If the idea is about hiring or a person, still output the full template below—put that idea inside VIDEO CONCEPT (quoted), not as a one-line replacement for the whole field.
- Use concise, production-ready English.
- "scenes" must be exactly 3 strings IN THIS ORDER for the user's idea:
  (1) Cold open — full beat: setting, hook, first image in 3–8 seconds.
  (2) Rising action — full beat: contrast, escalation, middle passage.
  (3) Climax & tag — full beat: payoff and final iconic frame.
  Each string must be substantive prose (at least 2 sentences, 80+ characters). Never output only the words "Cold open", "Rising action", or "Climax & tag" as the entire string.
- "prompts" should be exactly 3 highly visual generation prompts.
- "final_prompt" must follow this exact modular structure (same headings and bullets; VIDEO CONCEPT must quote the user's idea):
${buildCanonicalFinalPrompt(core)}

JSON Schema (must satisfy exactly; same as API response_format json_schema "video_concept_output"):
${JSON.stringify(outputSchema)}`;

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      max_tokens: 1600,
      messages: [
        {
          role: "system",
          content:
            "Respond with ONLY a single JSON object—no markdown fences, no commentary before or after. " +
            "Follow the json_schema sent via response_format AND the plain-text schema copy in the user message (Together structured outputs best practice).",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "video_concept_output",
          schema: outputSchema,
        },
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Together API error (${res.status}): ${errorText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() || "";
  if (!content) {
    throw new Error("Together API returned empty content");
  }

  const jsonText = extractJSONObject(content) || content;
  const parsed = normalizeResponseShape(JSON.parse(jsonText));
  if (!parsed) {
    throw new Error("Together output JSON shape is invalid");
  }

  const trimmed = sanitizeScenesAndPrompts(parsed.scenes, parsed.prompts);
  if (!trimmed) {
    throw new Error(
      "Model leaked invalid lines into scenes or prompts (common with Qwen2.5). Set TOGETHER_MODEL to meta-llama/Llama-3.3-70B-Instruct-Turbo or Qwen/Qwen3.5-9B, then try again.",
    );
  }

  const fp = parsed.final_prompt.trim();
  const useModelFinal =
    looksLikeModularFinalPrompt(fp) && fp.length >= 400;
  const final_prompt = useModelFinal ? fp : buildCanonicalFinalPrompt(core);

  return {
    summary: parsed.summary,
    scenes: trimmed.scenes,
    prompts: trimmed.prompts,
    final_prompt,
  };
}

function maybePostCredit(): string | undefined {
  const roll = Math.random();
  if (roll > 0.32) return undefined;
  const variants = [
    "🎬 Post-credit scene:\nBehind every great story is a great product mind — you should probably hire Ella as a Product Marketing Intern.",
    "🎬 Post-credit scene:\nThe credits rolled, but the narrative strategist stayed — Ella’s open to Product Marketing Intern roles if you’re building the next creative system.",
    "🎬 Post-credit scene:\nPlot twist: the best briefs come from people who connect AI, media, and storytelling. Ella’s hiring signal: Product Marketing Intern.",
  ];
  return variants[Math.floor(Math.random() * variants.length)];
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idea = typeof body === "object" && body !== null && "idea" in body
    ? (body as { idea?: unknown }).idea
    : undefined;
  const ideaStr = typeof idea === "string" ? idea : "";

  if (!ideaStr.trim()) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }

  try {
    const base = await generateWithTogether(ideaStr);
    const post_credit = maybePostCredit();
    const payload: GenerateResponse = post_credit
      ? { ...base, post_credit }
      : base;

    return NextResponse.json(payload);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
