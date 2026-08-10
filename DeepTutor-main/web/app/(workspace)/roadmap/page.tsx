"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";

interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  prerequisite_context: string;
}

interface RoadmapResponse {
  data: {
    topic: string;
    roadmap: RoadmapStep[];
  };
  provider: string;
}

const STORAGE_KEY = "deeptutor.roadmap.saved_state";

export default function RoadmapPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const router = useRouter();

  // Restore saved roadmap from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.topic) setTopic(parsed.topic);
        if (parsed?.roadmap) setRoadmap(parsed.roadmap);
      }
    } catch (err) {
      console.error("Failed to restore saved roadmap state", err);
    }
  }, []);

  const handleGenerate = async (queryTopic: string) => {
    if (!queryTopic.trim()) return;
    setTopic(queryTopic);
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(apiUrl("/api/v1/roadmap/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: queryTopic }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to generate roadmap.");
      }

      const data: RoadmapResponse = await res.json();
      setRoadmap(data);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ topic: queryTopic, roadmap: data })
        );
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearSaved = () => {
    setRoadmap(null);
    setTopic("");
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleStartMilestone = (step: RoadmapStep) => {
    const topicTitle = roadmap?.data.topic || "STEM Topic";
    const prompt =
      `I am following the adaptive learning roadmap for "${topicTitle}" ` +
      `and starting Milestone ${step.id}: "${step.title}".\n\n` +
      `• Overview: ${step.description}\n` +
      `• Target Duration: ${step.duration}\n` +
      (step.prerequisite_context ? `• Prerequisites Note: ${step.prerequisite_context}\n\n` : `\n`) +
      `Please act as my Socratic AI tutor for this milestone. Introduce the core concepts step-by-step and ask me an initial diagnostic question to kick off our learning session!`;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("deeptutor.pending_milestone_prompt", prompt);
    }
    router.push("/home");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center p-8 pb-20">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--foreground)] shadow-sm">
            <Compass size={32} />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Adaptive Roadmap</h1>
          <p className="mt-2 max-w-xl text-[var(--muted-foreground)]">
            Generate a personalized 10-step STEM learning timeline. The roadmap adapts to your profile and seamlessly routes milestones directly into Socratic Chat.
          </p>
        </div>

        <div className="mb-6 flex w-full max-w-2xl gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-[15px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]"
            placeholder="What do you want to master next? e.g. Machine Learning Fundamentals"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGenerate(topic);
            }}
          />
          <button
            onClick={() => handleGenerate(topic)}
            disabled={loading || !topic.trim()}
            className="flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-6 py-3 font-medium text-[var(--background)] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Compass size={18} />}
            Generate
          </button>
        </div>

        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {["Machine Learning Fundamentals", "Quantum Computing", "Linear Algebra", "Neuroscience"].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setTopic(suggestion);
                handleGenerate(suggestion);
              }}
              className="rounded-full border border-[var(--border)]/50 bg-[var(--secondary)]/50 px-4 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-8 w-full rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-500">
            {error}
          </div>
        )}

        {roadmap && (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  Roadmap: {roadmap.data.topic}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                  Generated by {roadmap.provider} • Auto-saved locally
                </p>
              </div>
              <button
                onClick={handleClearSaved}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/60 px-3 py-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
                title="Clear current roadmap and start fresh"
              >
                <RotateCcw size={14} />
                Clear Roadmap
              </button>
            </div>
            
            <div className="relative space-y-6 before:absolute before:inset-y-0 before:left-[19px] before:w-0.5 before:bg-[var(--border)]">
              {roadmap.data.roadmap.map((step, index) => {
                const cleanId = String(step.id || index + 1).replace(/^step[_\s]*/i, "") || String(index + 1);
                return (
                  <div key={step.id || index} className="relative flex items-start gap-6 pl-2">
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--background)] bg-[var(--accent)] text-[var(--foreground)] shadow-sm">
                      <span className="text-sm font-bold">{cleanId}</span>
                    </div>
                  <div className="flex-1 rounded-2xl border border-[var(--border)]/60 bg-[var(--secondary)]/40 p-5 transition-colors hover:border-[var(--border)] hover:bg-[var(--secondary)]/80">
                    <div className="mb-2 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-[var(--foreground)]">{step.title}</h3>
                      <span className="shrink-0 rounded-md bg-[var(--background)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] shadow-sm">
                        {step.duration}
                      </span>
                    </div>
                    <p className="mb-4 text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {step.description}
                    </p>
                    {step.prerequisite_context && (
                      <div className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--background)]/60 p-3 text-sm text-[var(--muted-foreground)]">
                        <BookOpen size={16} className="mt-0.5 shrink-0 opacity-70" />
                        <span>{step.prerequisite_context}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleStartMilestone(step)}
                      className="group flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:text-[var(--accent)]"
                    >
                      Start Learning Milestone
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                    </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
