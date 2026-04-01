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
      final_prompt: { type: "string" },
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
- Use concise, production-ready English.
- "scenes" must be exactly 3 strings IN THIS ORDER for the user's idea:
  (1) Cold open — full beat: setting, hook, first image in 3–8 seconds.
  (2) Rising action — full beat: contrast, escalation, middle passage.
  (3) Climax & tag — full beat: payoff and final iconic frame.
  Each string must be substantive prose (at least 2 sentences, 80+ characters). Never output only the words "Cold open", "Rising action", or "Climax & tag" as the entire string.
- "prompts" should be exactly 3 highly visual generation prompts.
- "final_prompt" must follow this exact modular structure and headings:
VIDEO CONCEPT:
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
* Focus on originality and clarity

Output schema (must match exactly):
${JSON.stringify(outputSchema)}`;

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You generate structured JSON for cinematic video concept planning.",
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
  return parsed;
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
