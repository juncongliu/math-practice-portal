import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { applyManualOverride } from '@/lib/auto_grader';

// PATCH /api/grade — parent/manual override of a submission
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { submission_id, overrides, final_score, notes, reviewed_by } = body as {
    submission_id: string;
    overrides: Record<string, { is_correct: boolean | null; notes?: string }>;
    final_score?: number;
    notes?: string;
    reviewed_by: string;
  };

  if (!submission_id || !reviewed_by) {
    return NextResponse.json({ error: 'submission_id and reviewed_by are required' }, { status: 400 });
  }

  // Fetch current submission
  const { data: current, error: fErr } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submission_id)
    .single();

  if (fErr || !current) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  // Apply overrides
  const updatedAnswers = applyManualOverride(current.answers as any, overrides);
  const reviewedAt = new Date().toISOString();

  const { data: updated, error: uErr } = await supabase
    .from('submissions')
    .update({
      answers: updatedAnswers,
      final_score: final_score ?? current.auto_score,
      status: 'reviewed',
      reviewed_by,
      reviewed_at: reviewedAt,
      notes: notes ?? current.notes,
    })
    .eq('id', submission_id)
    .select()
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  return NextResponse.json({ submission: updated });
}
