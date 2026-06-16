import { createServerClient } from '@/lib/supabase';
import WorksheetPractice from '@/components/WorksheetPractice';
import type { PageProps } from '@/types';

export async function generateMetadata({ params, searchParams }: PageProps) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('assignments')
    .select('title')
    .eq('id', params?.assignmentId as string)
    .single();
  return { title: data?.title ?? 'Practice' };
}

export default async function WorksheetPage({ params, searchParams }: PageProps) {
  const assignmentId = params?.assignmentId as string;
  const studentId = searchParams?.student_id as string;

  if (!assignmentId || !studentId) {
    return <div className="p-6 text-red-600">Missing assignment or student ID</div>;
  }

  const supabase = createServerClient();
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (!assignment) {
    return <div className="p-6 text-red-600">Assignment not found</div>;
  }

  // Server-side submit handler
  async function handleSubmit(answers: Record<string, string>) {
    'use server';
    const { createServerClient } = await import('@/lib/supabase');
    const sb = createServerClient();

    const { data: assignment } = await sb
      .from('assignments')
      .select('id, title, problems')
      .eq('id', assignmentId)
      .single();

    if (!assignment) throw new Error('Assignment not found');

    const { autoGrade } = await import('@/lib/auto_grader');
    const gradeResult = autoGrade(assignment.problems, answers);

    const status = gradeResult.uncertain_count > 0 ? 'pending_review' : 'auto_graded_only';

    const { data: submission, error } = await sb
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_id: studentId,
        answers: gradeResult.answers,
        auto_score: gradeResult.auto_score,
        status,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      submission,
      auto_score: gradeResult.auto_score,
      total_points: gradeResult.total_points,
      uncertain_count: gradeResult.uncertain_count,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WorksheetPractice assignment={assignment} onSubmit={handleSubmit} />
    </div>
  );
}
