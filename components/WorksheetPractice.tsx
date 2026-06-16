'use client';

import { useState, useCallback } from 'react';
import type { Problem, AnswerEntry } from '@/lib/supabase';

interface Props {
  assignment: {
    id: string;
    title: string;
    problems: Problem[];
  };
  onSubmit: (answers: Record<string, string>) => Promise<{
    submission: any;
    auto_score: number;
    total_points: number;
    uncertain_count: number;
  }>;
}

export default function WorksheetPractice({ assignment, onSubmit }: Props) {
  const { problems } = assignment;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{
    submission: any;
    auto_score: number;
    total_points: number;
    uncertain_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((problemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [problemId]: value }));
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await onSubmit(answers);
      setResult(res);
      setSubmitted(true);
    } catch (e: any) {
      setError(e?.message ?? 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const unanswered = problems.filter((p) => !answers[p.id]?.trim());

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">{assignment.title}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {problems.length} problems ·{' '}
        {unanswered.length > 0 ? `${unanswered.length} remaining` : 'all answered'}
      </p>

      <div className="space-y-6">
        {problems.map((problem, idx) => {
          const entry = result?.submission?.answers?.find(
            (a: AnswerEntry) => a.problem_id === problem.id
          );
          return (
            <div key={problem.id} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-semibold shrink-0">
                  {idx + 1}
                </span>
                <p className="text-base leading-relaxed pt-0.5">{problem.text}</p>
              </div>

              {submitted && entry ? (
                <div className="mt-2">
                  {entry.grade_status === 'auto' && (
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        entry.is_correct === true
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {entry.is_correct === true ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  )}
                  {entry.grade_status === 'pending' && (
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                      ? Needs review
                    </span>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    Your answer: <span className="font-mono">{entry.student_answer || '(empty)'}</span>
                  </p>
                  {entry.is_correct === false && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Correct answer: <span className="font-mono font-semibold">{problem.answer}</span>
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  value={answers[problem.id] ?? ''}
                  onChange={(e) => handleChange(problem.id, e.target.value)}
                  placeholder="Type your answer…"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-red-600 text-sm">{error}</p>
      )}

      {!submitted ? (
        <button
          onClick={handleSubmit}
          disabled={loading || unanswered.length > 0}
          className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
        >
          {loading ? 'Grading…' : 'Submit Answers'}
        </button>
      ) : result ? (
        <div className="mt-6 p-4 rounded-lg bg-gray-50 border space-y-2">
          <p className="font-semibold text-lg">
            Score: {result.auto_score} / {result.total_points}
          </p>
          {result.uncertain_count > 0 && (
            <p className="text-sm text-yellow-700">
              {result.uncertain_count} answer(s) need teacher review — you'll be notified once reviewed.
            </p>
          )}
          {result.uncertain_count === 0 && (
            <p className="text-sm text-green-700">All answers auto-graded! You're done.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
