"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Video,
  FileQuestion,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowLeft,
  Clock,
  Loader2,
  Send,
  Bot,
  Sparkles,
  Award,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface TranscriptLine {
  time: string;
  text: string;
}

interface Question {
  id: string;
  type: "mcq" | "essay";
  question: string;
  options?: string[];
  answer?: string;
  explanation?: string;
  rubric?: string;
  misconceptions?: Record<string, string>;
}

interface KbConcept {
  tag: string;
  title: string;
  description: string;
}

interface CourseItem {
  id: string;
  type: "video" | "quiz";
  title: string;
  url?: string;
  duration?: string;
  kb_tags?: string[];
  kb_concepts?: KbConcept[];
  is_module_ending?: boolean;
  transcript?: TranscriptLine[];
  questions?: Question[];
}

interface Module {
  module_id: string;
  title: string;
  items: CourseItem[];
}

interface CourseData {
  course_id: string;
  title: string;
  instructor: string;
  description: string;
  modules: Module[];
}

export default function CourseViewerPage({ params }: { params: Promise<{ courseId: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.courseId;
  const router = useRouter();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CourseItem | null>(null);

  // Quiz state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, { correct: boolean; score: number; feedback: string }>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  // Video completion & module completion notification state
  const [watchedVideos, setWatchedVideos] = useState<Record<string, boolean>>({});
  const [completedModules, setCompletedModules] = useState<Record<string, boolean>>({});
  const [activeModuleBanner, setActiveModuleBanner] = useState<{
    moduleTitle: string;
    learnedConcepts: string[];
    misconceptions: string[];
    essayFeedback: string;
  } | null>(null);

  // Load Course Progress from LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`deeptutor_course_progress_${courseId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.watchedVideos) setWatchedVideos(parsed.watchedVideos);
        if (parsed.mcqAnswers) setMcqAnswers(parsed.mcqAnswers);
        if (parsed.essayAnswers) setEssayAnswers(parsed.essayAnswers);
        if (parsed.quizResults) setQuizResults(parsed.quizResults);
        if (parsed.completedModules) setCompletedModules(parsed.completedModules);
      }
    } catch (e) {
      console.error("Failed to load course progress from localStorage", e);
    }
  }, [courseId]);

  // Auto-save Course Progress to LocalStorage
  useEffect(() => {
    try {
      const dataToSave = { watchedVideos, mcqAnswers, essayAnswers, quizResults, completedModules };
      localStorage.setItem(`deeptutor_course_progress_${courseId}`, JSON.stringify(dataToSave));
    } catch (e) {
      console.error("Failed to save course progress", e);
    }
  }, [courseId, watchedVideos, mcqAnswers, essayAnswers, quizResults, completedModules]);

  // Load Course Data
  useEffect(() => {
    async function loadData() {
      try {
        const courseRes = await apiFetch(`/api/v1/courses/${courseId}`);

        if (courseRes.ok) {
          const cData = await courseRes.json();
          setCourse(cData.data);
          // Default to first item
          if (cData.data?.modules?.[0]?.items?.[0]) {
            setSelectedItem(cData.data.modules[0].items[0]);
          }
        }
      } catch (err) {
        console.error("Error loading course data", err);
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [courseId]);

  // Handle Mark Video Watched (Emits L1 Trace Event into surface="chat")
  const handleMarkVideoWatched = async (item: CourseItem) => {
    if (watchedVideos[item.id]) return;

    try {
      const res = await apiFetch(`/api/v1/courses/${courseId}/track_video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: item.id,
          title: item.title,
          kb_tags: item.kb_tags || [],
          kb_concepts: item.kb_concepts || [],
        }),
      });

      if (res.ok) {
        setWatchedVideos((prev) => ({ ...prev, [item.id]: true }));
      }
    } catch (err) {
      console.error("Failed to track video watch event", err);
    }
  };

  // Submit Quiz for Evaluation
  const handleSubmitQuiz = async (item: CourseItem, activeMod?: Module) => {
    if (!item.questions?.length) return;
    setSubmittingQuiz(true);

    const results: Record<string, { correct: boolean; score: number; feedback: string }> = {};
    let latestEssayFeedback = "";

    try {
      for (const q of item.questions) {
        const studentAns = q.type === "mcq" ? mcqAnswers[q.id] || "" : essayAnswers[q.id] || "";
        if (!studentAns) continue;

        const res = await apiFetch(`/api/v1/courses/${courseId}/quiz/evaluate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: q.id,
            question_type: q.type,
            student_answer: studentAns,
            expected_answer: q.answer,
            rubric: q.rubric,
            misconceptions: q.misconceptions,
          }),
        });

        if (res.ok) {
          const evalData = await res.json();
          results[q.id] = {
            correct: evalData.correct,
            score: evalData.score,
            feedback: evalData.feedback,
          };
          if (q.type === "essay") {
            latestEssayFeedback = evalData.feedback;
          }
        }
      }
      setQuizResults((prev) => ({ ...prev, ...results }));

      // If this is a module-ending reflection essay, calculate module completion and emit L1 module_completed trace!
      if (item.is_module_ending && activeMod) {
        // Collect all kb_concepts in module
        const allKbConcepts = activeMod.items.flatMap((it) => it.kb_concepts || []);
        const conceptTitles = Array.from(
          new Set(
            allKbConcepts.map((c) => c.title || c.tag).concat(activeMod.items.flatMap((it) => it.kb_tags || []))
          )
        );

        // Collect all misconceptions from missed MCQs in module
        const missedMisconceptions: string[] = [];
        for (const it of activeMod.items) {
          if (it.questions) {
            for (const q of it.questions) {
              if (q.type === "mcq" && q.misconceptions) {
                const chosen = mcqAnswers[q.id];
                if (chosen && chosen !== q.answer && q.misconceptions[chosen]) {
                  missedMisconceptions.push(q.misconceptions[chosen]);
                }
              }
            }
          }
        }

        // Call module completion endpoint
        const compRes = await apiFetch(
          `/api/v1/courses/${courseId}/modules/${activeMod.module_id}/complete`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              module_id: activeMod.module_id,
              module_title: activeMod.title,
              learned_concepts: allKbConcepts,
              misconceptions: missedMisconceptions,
              essay_feedback: latestEssayFeedback,
            }),
          }
        );

        if (compRes.ok) {
          setCompletedModules((prev) => ({ ...prev, [activeMod.module_id]: true }));
          setActiveModuleBanner({
            moduleTitle: activeMod.title,
            learnedConcepts: conceptTitles,
            misconceptions: missedMisconceptions,
            essayFeedback: latestEssayFeedback,
          });
        }
      }
    } catch (err) {
      console.error("Failed to evaluate quiz", err);
    } finally {
      setSubmittingQuiz(false);
    }
  };

  // Auto-track video completion when a video item is selected
  useEffect(() => {
    if (selectedItem && selectedItem.type === "video" && !watchedVideos[selectedItem.id]) {
      void handleMarkVideoWatched(selectedItem);
    }
  }, [selectedItem, watchedVideos]);

  // Reset course progress on both frontend local storage and backend SQLite database
  const handleResetCourseProgress = async () => {
    setWatchedVideos({});
    setMcqAnswers({});
    setEssayAnswers({});
    setQuizResults({});
    setCompletedModules({});
    setActiveModuleBanner(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`deeptutor_course_progress_${courseId}`);
    }
    try {
      await apiFetch(`/api/v1/courses/${courseId}/reset`, { method: "POST" });
    } catch (err) {
      console.error("Failed to reset backend course session", err);
    }
  };

  const handleAskAIAssistant = (contextText: string) => {
    const prompt = `I'm studying the course "${course?.title}". I have a question about: "${contextText}". Can you explain this in detail?`;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("deeptutor.pending_milestone_prompt", prompt);
    }
    router.push("/home");
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-neutral-950 text-neutral-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mr-3" />
        <span>Loading specialized course content...</span>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="h-full w-full p-10 bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold">Course Not Found</h2>
        <Link href="/courses" className="mt-4 text-indigo-400 hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Courses
        </Link>
      </div>
    );
  }

  // Find active module for current item
  const currentModule = course.modules.find((mod) =>
    mod.items.some((it) => it.id === selectedItem?.id)
  );

  return (
    <div className="h-full w-full flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-16 bg-neutral-900 border-b border-neutral-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/courses" className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">{course.title}</h1>
            <p className="text-xs text-neutral-400">Instructor: {course.instructor}</p>
          </div>
        </div>

        <button
          onClick={handleResetCourseProgress}
          className="inline-flex items-center gap-2 bg-neutral-800 hover:bg-red-950/60 border border-neutral-700 hover:border-red-700/60 text-neutral-300 hover:text-red-400 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5 text-red-400" />
          <span>Reset Course Progress</span>
        </button>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Curriculum Navigation */}
        <aside className="w-80 bg-neutral-900/80 border-r border-neutral-800 overflow-y-auto shrink-0 flex flex-col justify-between">
          <div className="p-4 space-y-6">
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-2">
              Course Curriculum
            </div>

            <div className="space-y-4">
              {course.modules.map((mod) => {
                const isModComplete = completedModules[mod.module_id];

                return (
                  <div key={mod.module_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-300 px-2.5 py-1.5 bg-indigo-950/40 rounded-lg border border-indigo-900/40">
                      <span className="truncate">{mod.title}</span>
                      {isModComplete && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 ml-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Done</span>
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 pl-1">
                      {mod.items.map((item) => {
                        const isSelected = selectedItem?.id === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs transition-all text-left group ${
                              isSelected
                                ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-950/40"
                                : "hover:bg-neutral-800/80 text-neutral-300"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {item.type === "video" ? (
                                <Video className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-indigo-400"}`} />
                              ) : item.is_module_ending ? (
                                <Award className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-purple-400"}`} />
                              ) : (
                                <FileQuestion className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-amber-400"}`} />
                              )}
                              <span className="truncate">{item.title}</span>
                            </div>
                            {item.type === "video" && watchedVideos[item.id] && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Pane: Active Item Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-neutral-950 pb-20">
          {activeModuleBanner && (
            <div className="max-w-4xl mx-auto mb-6 bg-gradient-to-r from-emerald-950/80 via-neutral-900 to-indigo-950/80 border border-emerald-500/40 rounded-2xl p-5 text-emerald-200 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-400">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Module Completed & L1 Memory Trace Logged!</span>
                </div>
                <button
                  onClick={() => setActiveModuleBanner(null)}
                  className="text-xs text-neutral-400 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-xs text-neutral-300">
                <strong>{activeModuleBanner.moduleTitle}</strong> telemetry has been appended to DeepTutor&apos;s virtual video tutor chat log (<code className="font-mono text-indigo-400">surface=&quot;chat&quot;</code>).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-black/30 p-2.5 rounded-xl border border-emerald-900/40">
                  <span className="font-semibold text-emerald-400 block mb-1">Mastered Concepts:</span>
                  <span>{activeModuleBanner.learnedConcepts.join(", ") || "None"}</span>
                </div>
                <div className="bg-black/30 p-2.5 rounded-xl border border-emerald-900/40">
                  <span className="font-semibold text-amber-400 block mb-1">Misconceptions Encountered:</span>
                  <span>{activeModuleBanner.misconceptions.join(", ") || "None"}</span>
                </div>
              </div>
              {activeModuleBanner.essayFeedback && (
                <div className="bg-black/30 p-2.5 rounded-xl border border-indigo-900/40 text-xs">
                  <span className="font-semibold text-indigo-300 block mb-1">AI Evaluator Comment:</span>
                  <span>&quot;{activeModuleBanner.essayFeedback}&quot;</span>
                </div>
              )}
            </div>
          )}

          {selectedItem ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Item Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <span className={`text-xs font-mono font-medium px-2.5 py-1 rounded-md border uppercase ${
                    selectedItem.is_module_ending
                      ? "text-purple-400 bg-purple-950 border-purple-800/60"
                      : selectedItem.type === "video"
                      ? "text-indigo-400 bg-indigo-950 border-indigo-800/50"
                      : "text-amber-400 bg-amber-950 border-amber-800/50"
                  }`}>
                    {selectedItem.is_module_ending ? "Module Ending Capstone (Essay)" : selectedItem.type === "video" ? "Video Lecture" : "Mid-Module Checkpoint (MCQ)"}
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-2">{selectedItem.title}</h2>
                </div>

                <div className="flex items-center gap-3">
                  {selectedItem.type === "video" && (
                    <button
                      onClick={() => handleMarkVideoWatched(selectedItem)}
                      disabled={watchedVideos[selectedItem.id]}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                        watchedVideos[selectedItem.id]
                          ? "bg-emerald-950/80 border border-emerald-800/60 text-emerald-400"
                          : "bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/60 text-indigo-200"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>{watchedVideos[selectedItem.id] ? "Completed (L1 Event Emitted)" : "Mark Video Completed"}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleAskAIAssistant(selectedItem.title)}
                    className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-indigo-300 px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
                  >
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span>Ask AI Tutor about this</span>
                  </button>
                </div>
              </div>

              {/* VIDEO PLAYER VIEW */}
              {selectedItem.type === "video" && (
                <div className="space-y-6">
                  {/* HTML5 Video Player */}
                  <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-2xl aspect-video">
                    {selectedItem.url ? (
                      <video
                        controls
                        src={selectedItem.url}
                        className="w-full h-full object-cover"
                        poster="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                        <Play className="w-12 h-12 mb-2" />
                        <span>Placeholder Video Player</span>
                      </div>
                    )}
                  </div>

                  {/* Interactive Transcript */}
                  {selectedItem.transcript && (
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-indigo-400" />
                        <span>Video Transcript & AI Context</span>
                      </h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {selectedItem.transcript.map((line, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleAskAIAssistant(`Timestamp ${line.time}: "${line.text}"`)}
                            className="flex items-start gap-3 p-2 rounded-lg hover:bg-neutral-800/60 cursor-pointer transition-colors group"
                          >
                            <span className="text-xs font-mono text-indigo-400 shrink-0 mt-0.5">{line.time}</span>
                            <span className="text-xs text-neutral-300 group-hover:text-white transition-colors">
                              {line.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* QUIZ ENGINE VIEW */}
              {selectedItem.type === "quiz" && selectedItem.questions && (
                <div className="space-y-6">
                  <div className="space-y-6">
                    {selectedItem.questions.map((q, idx) => {
                      const res = quizResults[q.id];

                      return (
                        <div
                          key={q.id}
                          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-xs font-bold text-indigo-400 bg-indigo-950 px-2.5 py-1 rounded-md border border-indigo-800/60">
                              Question {idx + 1} ({q.type.toUpperCase()})
                            </span>

                            {res && (
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border ${
                                  res.correct
                                    ? "bg-emerald-950 text-emerald-400 border-emerald-800/60"
                                    : "bg-red-950 text-red-400 border-red-800/60"
                                }`}
                              >
                                {res.correct ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                <span>{res.correct ? "Correct" : `Score: ${res.score}`}</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-white leading-relaxed">{q.question}</h3>

                          {/* MCQ Options (Non-Module Ending) */}
                          {q.type === "mcq" && q.options && (
                            <div className="space-y-2 pt-2">
                              {q.options.map((opt) => {
                                const optLetter = opt.charAt(0);
                                const isChecked = mcqAnswers[q.id] === optLetter;

                                return (
                                  <label
                                    key={opt}
                                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                      isChecked
                                        ? "bg-indigo-950/80 border-indigo-500 text-white font-medium"
                                        : "bg-neutral-950/60 border-neutral-800 hover:bg-neutral-800/60 text-neutral-300"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={q.id}
                                      value={optLetter}
                                      checked={isChecked}
                                      onChange={() => setMcqAnswers({ ...mcqAnswers, [q.id]: optLetter })}
                                      className="accent-indigo-500"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {/* Essay Textarea (Module Ending Capstone) */}
                          {q.type === "essay" && (
                            <div className="space-y-2 pt-2">
                              <textarea
                                value={essayAnswers[q.id] || ""}
                                onChange={(e) => setEssayAnswers({ ...essayAnswers, [q.id]: e.target.value })}
                                placeholder="Write your reflection essay here... (Evaluated by DeepTutor AI judge against teacher rubric)"
                                rows={5}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                              />
                            </div>
                          )}

                          {/* Evaluation Feedback */}
                          {res && (
                            <div
                              className={`p-3.5 rounded-xl text-xs border ${
                                res.correct
                                  ? "bg-emerald-950/40 border-emerald-800/50 text-emerald-300"
                                  : "bg-red-950/40 border-red-800/50 text-red-300"
                              }`}
                            >
                              <span className="font-semibold block mb-0.5">Evaluator Feedback:</span>
                              <span>{res.feedback}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={() => handleSubmitQuiz(selectedItem, currentModule)}
                      disabled={submittingQuiz}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium px-6 py-3 rounded-xl text-xs transition-all disabled:opacity-50 shadow-lg shadow-indigo-950/40"
                    >
                      {submittingQuiz ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Evaluating Assessment...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>{selectedItem.is_module_ending ? "Submit Capstone Reflection Essay" : "Submit MCQ Checkpoint"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
              <span>Select a module item from the left sidebar to start learning.</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
