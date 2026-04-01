"use client";

import { useCallback, useEffect, useState } from "react";

type GenerateResult = {
  summary: string;
  scenes: string[];
  prompts: string[];
  final_prompt: string;
  post_credit?: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [ellaOpen, setEllaOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const showToast = useCallback((message: string, durationMs = 2200) => {
    setToast(message);
    window.setTimeout(() => setToast(null), durationMs);
  }, []);

  const generate = useCallback(async () => {
    const idea = input.trim();
    if (!idea) return;
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Request failed");
      }
      const data = (await res.json()) as GenerateResult;
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      showToast(msg, 5500);
    } finally {
      setLoading(false);
    }
  }, [input, showToast]);

  useEffect(() => {
    if (!ellaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEllaOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [ellaOpen]);

  const copyFinal = useCallback(async () => {
    if (!result) return;
    const ok = await copyText(result.final_prompt);
    showToast(ok ? "Copied final prompt" : "Could not copy");
    setCopiedKey("final");
    window.setTimeout(() => setCopiedKey(null), 1500);
  }, [result, showToast]);

  const downloadTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      "AI Video Concept Planner — export",
      "",
      "STORY SUMMARY",
      result.summary,
      "",
      "SCENE BREAKDOWN",
      ...result.scenes.map((s, i) => `${i + 1}. ${s}`),
      "",
      "VISUAL PROMPTS",
      ...result.prompts.map((p, i) => `${i + 1}. ${p}`),
      "",
      "FINAL VIDEO PROMPT",
      result.final_prompt,
    ];
    if (result.post_credit) lines.push("", result.post_credit);
    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-concept.txt";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Download started");
  }, [result, showToast]);

  const empty = !input.trim();
  const sceneLabels = ["Cold open", "Rising action", "Climax & tag"];
  const getSceneBody = useCallback((label: string, text?: string) => {
    if (!text) return "No scene generated for this beat.";
    const raw = text.trim();
    const titleOnly =
      /^(cold\s*open|rising\s*action|climax\s*(?:&|and)\s*tag)\.?$/i.test(
        raw,
      );
    if (titleOnly) {
      return "The model only returned a section title. Click Regenerate for a full scene description.";
    }
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixPattern = new RegExp(
      `^\\s*(?:${escapedLabel}|cold\\s*open|rising\\s*action|climax\\s*(?:&|and)\\s*tag)\\s*[:\\-\\u2014]?\\s*`,
      "i",
    );
    return raw.replace(prefixPattern, "").trim() || raw;
  }, []);

  return (
    <main className="nebula-bg relative min-h-screen overflow-hidden px-4 pb-24 pt-14 text-slate-100 sm:px-6 sm:pt-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-8 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -right-20 top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute bottom-[-80px] left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl">
        <header className="animate-fade-in text-center">
          <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-200">
            Cinematic AI Lab
          </p>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            AI Video Concept Planner
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-[15px] leading-relaxed text-slate-300 sm:text-lg">
            Transform one spark of inspiration into Hollywood trailer-level
            story structure, shot-by-shot breakdowns, and generative prompts.
          </p>
        </header>

        <section className="glass-panel mt-12 space-y-4 animate-fade-in p-5 sm:p-7">
          <label htmlFor="idea" className="sr-only">
            Video idea
          </label>
          <textarea
            id="idea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your video idea..."
            rows={6}
            className="w-full resize-y rounded-2xl border border-white/20 bg-slate-950/60 px-4 py-4 text-[15px] leading-relaxed text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-cyan-300/60 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.15)]"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={empty || loading}
              onClick={generate}
              className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-cyan-200/40 bg-gradient-to-r from-cyan-400 to-violet-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.8)] transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700/30 border-t-slate-900"
                    aria-hidden
                  />
                  Generating…
                </span>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        </section>

        {result && (
          <div className="mt-12 space-y-8 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">
            <section className="glass-panel p-6 sm:p-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                Story summary
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-200">
                {result.summary}
              </p>
            </section>

            <section className="glass-panel p-6 sm:p-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                Scene breakdown
              </h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {sceneLabels.map((label, i) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-cyan-200/20 bg-slate-900/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
                      {label}
                    </p>
                    <p className="mt-3 text-[14px] leading-relaxed text-slate-200">
                      {getSceneBody(label, result.scenes[i])}
                    </p>
                  </article>
                ))}
              </div>
              {result.scenes.length > 3 && (
                <div className="mt-5 rounded-xl border border-dashed border-white/20 bg-slate-900/50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Additional beats
                  </p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-slate-300 marker:text-violet-300/70">
                    {result.scenes.slice(3).map((scene, idx) => (
                      <li key={`${idx}-${scene}`}>{scene}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="glass-panel p-6 sm:p-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                Visual prompts
              </h2>
              <ul className="mt-4 list-disc space-y-3 pl-5 text-[15px] leading-relaxed text-slate-200 marker:text-violet-300/80">
                {result.prompts.map((p, i) => (
                  <li key={i} className="font-mono text-[13px] text-slate-300">
                    {p}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-200/80">
                Final video prompt
              </h2>
              <div className="mt-3 overflow-hidden rounded-2xl border border-fuchsia-300/30 bg-gradient-to-b from-fuchsia-400/20 via-violet-500/15 to-slate-950/60 shadow-[0_16px_60px_-20px_rgba(217,70,239,0.8)] ring-1 ring-fuchsia-200/20">
                <div className="flex items-center justify-between border-b border-white/10 bg-slate-950/35 px-5 py-3 sm:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-100/80">
                    Production-ready prompt
                  </p>
                  <button
                    type="button"
                    onClick={copyFinal}
                    className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur transition hover:border-cyan-200/70 hover:bg-cyan-300/20"
                  >
                    {copiedKey === "final" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="whitespace-pre-wrap break-words font-mono text-[13px] leading-7 text-slate-100 sm:text-[14px]">
                    {result.final_prompt}
                  </p>
                </div>
              </div>
            </section>

            {result.post_credit && (
              <p className="text-center text-[13px] leading-relaxed text-slate-400 transition-opacity duration-500">
                {result.post_credit.split("\n").map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-slate-100 shadow-sm backdrop-blur transition hover:border-cyan-200/60 hover:bg-cyan-300/20 disabled:opacity-50"
              >
                Regenerate
              </button>
              <button
                type="button"
                onClick={downloadTxt}
                className="rounded-full border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-slate-100 shadow-sm backdrop-blur transition hover:border-cyan-200/60 hover:bg-cyan-300/20"
              >
                Download (.txt)
              </button>
              <button
                type="button"
                onClick={() => setEllaOpen(true)}
                className="group relative isolate overflow-hidden rounded-full border border-fuchsia-200/50 bg-gradient-to-r from-fuchsia-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_-10px_rgba(232,121,249,0.85)] transition hover:scale-[1.03] hover:brightness-110 motion-safe:animate-ella-pulse"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 rounded-full opacity-0 blur-xl transition group-hover:opacity-90 motion-safe:animate-ella-glow"
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/45 blur-sm motion-safe:animate-ella-sweep"
                />
                <span className="relative z-10">✨ Hire Ella</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {ellaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ella-title"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-950/75 backdrop-blur-[3px] transition-opacity"
            onClick={() => setEllaOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md animate-modal-in rounded-3xl border border-white/20 bg-slate-900/90 p-8 shadow-[0_24px_90px_-20px_rgba(56,189,248,0.6)] opacity-0 [animation-fill-mode:forwards]">
            <button
              type="button"
              onClick={() => setEllaOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close dialog"
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <h2
              id="ella-title"
              className="pr-10 text-xl font-semibold tracking-tight text-white"
            >
              Hi I&apos;m Ella 👋🏻
            </h2>
            <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-slate-300">
              <p>
                I believe the most impactful technologies are those that bring
                people together and unlock new forms of creativity whether
                through music, video, or software.
              </p>
              <p className="text-cyan-200">
                I&apos;m excited to join{" "}
                <span className="font-bold underline decoration-cyan-100/80 underline-offset-2">
                  Together.AI as a Product Marketing Intern
                </span>{" "}
                in 2026.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="https://www.linkedin.com/in/ellalu05/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-cyan-200/50 bg-gradient-to-r from-cyan-300 to-violet-400 px-4 py-3 text-center text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Let’s Connect →
              </a>
              <a
                href="https://hiellalu.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-white/25 bg-white/10 px-4 py-3 text-center text-sm font-medium text-slate-100 transition hover:border-cyan-200/70 hover:bg-cyan-300/20"
              >
                Visit My Portfolio
              </a>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="pointer-events-none fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-cyan-200/30 bg-slate-900/90 px-5 py-2.5 text-sm text-cyan-100 shadow-[0_8px_40px_-12px_rgba(34,211,238,0.8)] backdrop-blur animate-fade-in"
          role="status"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
