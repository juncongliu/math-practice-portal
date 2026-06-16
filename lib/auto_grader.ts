import { compareAnswers, type CompareResult } from './math_parser';
import type { Problem, AnswerEntry } from './supabase';

export interface GradeResult {
  answers: AnswerEntry[];
  auto_score: number;
  total_points: number;
  uncertain_count: number; // count of null results needing manual review
}

/**
 * Auto-grade a student's submission against an assignment's answer key.
 */
export function autoGrade(
  problems: Problem[],
  studentAnswers: Record<string, string> // problem_id → student answer string
): GradeResult {
  const answers: AnswerEntry[] = [];
  let auto_score = 0;
  let total_points = 0;
  let uncertain_count = 0;

  for (const problem of problems) {
    total_points += problem.points;
    const studentAnswer = studentAnswers[problem.id] ?? '';
    const result: CompareResult = compareAnswers(studentAnswer, problem.answer);

    let is_correct: boolean | null = result.is_correct;
    let grade_status: AnswerEntry['grade_status'] = 'auto';

    if (is_correct === null) {
      grade_status = 'pending';
      uncertain_count++;
    }

    if (is_correct === true) {
      auto_score += problem.points;
    }

    answers.push({
      problem_id: problem.id,
      student_answer: studentAnswer,
      is_correct,
      grade_status,
    });
  }

  return { answers, auto_score, total_points, uncertain_count };
}

/**
 * Apply a manual review override to a submission.
 */
export function applyManualOverride(
  currentAnswers: AnswerEntry[],
  overrides: Record<string, { is_correct: boolean | null; notes?: string }>
): AnswerEntry[] {
  return currentAnswers.map((entry) => {
    const override = overrides[entry.problem_id];
    if (!override) return entry;

    return {
      ...entry,
      is_correct: override.is_correct,
      grade_status: 'manual',
    };
  });
}
