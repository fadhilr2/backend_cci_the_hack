"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, BookOpen, Clock, Award, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CourseSummary {
  course_id: string;
  title: string;
  instructor: string;
  description: string;
  module_count: number;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await apiFetch("/api/v1/courses");
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error("Failed to load courses", err);
      } finally {
        setLoading(false);
      }
    }
    fetchCourses();
  }, []);

  return (
    <div className="h-full w-full overflow-y-auto bg-neutral-950 text-neutral-100 p-6 md:p-10 font-sans pb-20">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="border-b border-neutral-800 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/50 text-indigo-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Coursera-Style Courses</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-indigo-400" />
              Specialized Courses
            </h1>
            <p className="text-neutral-400 text-sm mt-1">
              Curated video lectures, interactive quizzes, and real-time DKT Knowledge Base tracking.
            </p>
          </div>
        </div>

        {/* Loading / Courses Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3 text-indigo-400" />
            <span>Loading available courses...</span>
          </div>
        ) : courses.length === 0 ? (
          <div className="border border-dashed border-neutral-800 rounded-2xl p-12 text-center bg-neutral-900/30">
            <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-neutral-300 mb-1">No Courses Available</h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto">
              Check back soon for new teacher-crafted specialized courses.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.course_id}
                className="bg-neutral-900 border border-neutral-800 hover:border-indigo-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all group hover:shadow-xl hover:shadow-indigo-950/20"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800/60">
                      {course.course_id.toUpperCase()}
                    </span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                      {course.module_count} Modules
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">
                    {course.title}
                  </h3>

                  <p className="text-xs text-neutral-400 mb-4 line-clamp-3 leading-relaxed">
                    {course.description}
                  </p>

                  <div className="text-xs text-neutral-500 mb-6 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Instructor: <strong className="text-neutral-300">{course.instructor}</strong></span>
                  </div>
                </div>

                <Link
                  href={`/courses/${course.course_id}`}
                  className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-indigo-950/30"
                >
                  <span>Start Learning Course</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
