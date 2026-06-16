import { NextRequest, NextResponse } from 'next/server';
import { supabase, type Submission } from '@/lib/supabase';
import { autoGrade } from '@/lib/auto_grader';

// GET /api/submissions — list submissions
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id');
  const assignmentId = searchParams.get('assignment_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('submissions')
    .select('*, assignment:assignments(id, title, problems)')
    .order('submitted_at', { ascending: false });

  if (studentId)  query = query.eq('student_id', studentId);
  if (assignmentId) query = query.eq('assignment_id', assignmentId);
  if (status)     query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data });
}

// POST /api/submissions — submit answers (auto-grades immediately)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { assignment_id, student_id, answers } = body as {
    assignment_id: string;
    student_id: string;
    answers: Record<string, string>; // problem_id → answer string
  };

  if (!assignment_id || !student_id || !answers) {
    return NextResponse.json({ error: 'assignment_id, student_id, and answers are required' }, { status: 400 });
  }

  // Fetch assignment to get problems + answer key
  const { data: assignment, error: aErr } = await supabase
    .from('assignments')
    .select('id, title, problems')
    .eq('id', assignment_id)
    .single();

  if (aErr || !assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  // Auto-grade
  const gradeResult = autoGrade(assignment.problems, answers);

  const status =
    gradeResult.uncertain_count > 0 ? 'pending_review' : 'auto_graded_only';

  const { data: submission, error: sErr } = await supabase
    .from('submissions')
    .insert({
      assignment_id,
      student_id,
      answers: gradeResult.answers,
      auto_score: gradeResult.auto_score,
      status,
    })
    .select()
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  return NextResponse.json({
    submission,
    auto_score: gradeResult.auto_score,
    total_points: gradeResult.total_points,
    uncertain_count: gradeResult.uncertain_count,
  }, { status: 201 });
}
