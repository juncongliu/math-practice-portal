'use client';

import { useState } from 'react';
import type { AnswerEntry, Problem } from '@/lib/supabase';

interface Props {
  submission: {
    id: string;
    answers: AnswerEntry[];
    auto_score: number;
    assignment: {
      title: string;
      problems: Problem[];
    };
    student: { name: string };
  };
  parentId: string;
}

export default function ReviewForm({ submission, parentId }: Props) {
  const { answers, auto_score, assignment, student } = submission;
  const { problems } = assignment;

  const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setAnswer = (problemId: string, val: boolean | null) => {
    setOverrides((prev) => ({ ...prev, [problemId]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    const formatted: Record<string, { is_correct: boolean | null }> = {};
    for (const [pid, val] of Object.entries(overrides)) {
      formatted[pid] = { is_correct: val as boolean | null };
    }

    // Calculate final score from overrides
    let finalScore = auto_score;
    for (const problem of problems) {
      const override = overrides[problem.id];
      if (override === true && !answers.find((a) => a.problem_id === problem.id)?.is_correct) {
        finalScore += problem.points;
      } else if (override === false && answers.find((a) => a.problem_id === problem.id)?.is_correct === true) {
        finalScore -= problem.points;
      }
    }

    const res = await fetch('/api/grade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission.id,
        overrides: formatted,
        final_score: finalScore,
        notes,
        reviewed_by: parentId,
      }),
    });

    if (res.ok) {
      setSaved(true);
    } else {
      alert('Failed to save review');
    }
    setSaving(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Review: {assignment.title}</h1>
      <p className="text-gray-500 mb-6">Student: {student.name}</p>

      <div className="space-y-5">
        {problems.map((problem, idx) => {
          const entry = answers.find((a) => a.problem_id === problem.id);
          const current = entry?.is_correct;
          const override = overrides[problem.id] ?? current;

          return (
            <div key={problem.id} className="border rounded-lg p-4 bg-white">
              <div className="flex items-start gap-3 mb-2">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-sm font-semibold shrink-0">
                  {idx + 1}
                </span>
                <p className="text-base leading-relaxed">{problem.text}</p>
              </div>

              <div className="ml-10 space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Student answer:</span>{' '}
                  <span className="font-mono">{entry?.student_answer || '(empty)'}</span>
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Answer key:</span>{' '}
                  <span className="font-mono font-semibold">{problem.answer}</span>
                </p>

                <div className="flex items-center gap-4 mt-2">
                  {(['auto', 'manual'] as const).map((status) => {
                    const val = status === 'auto' ? current : override;
                    return (
                      <label key={status} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name={`${problem.id}-${status}`}
                          checked={val === true}
                          onChange={() => setAnswer(problem.id, true)}
                          className="accent-green-600"
                        />
                        <span className="text-green-700">✓ Correct</span>
                      </label>
                    );
                  })}
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`${problem.id}-correct`}
                      checked={override === false}
                      onChange={() => setAnswer(problem.id, false)}
                      className="accent-red-600"
                    />
                    <span className="text-red-700">✗ Incorrect</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name={`${problem.id}-correct`}
                      checked={override === null}
                      onChange={() => setAnswer(problem.id, null)}
                      className="accent-yellow-600"
                    />
                    <span className="text-yellow-700">? Uncertain</span>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium mb-1">Feedback notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add encouraging feedback for the student…"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="mt-4 w-full bg-green-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60 hover:bg-green-700 transition"
      >
        {saving ? 'Saving…' : saved ? '✓ Review Saved' : 'Save Review'}
      </button>
    </div>
  );
}
