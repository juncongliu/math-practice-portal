import { NextRequest, NextResponse } from 'next/server';
import { makeClient, type Assignment } from '@/lib/supabase';

// GET /api/assignments — list assignments (filtered by student or parent)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id');
  const topicId = searchParams.get('topic_id');

  let supabase;
  try {
    supabase = makeClient();
  } catch (e: any) {
    return NextResponse.json({ error: 'Supabase init failed: ' + e.message }, { status: 500 });
  }

  let query = supabase.from('assignments').select('*').order('created_at', { ascending: false });

  if (studentId) {
    const { data: subs, error: subsErr } = await supabase
      .from('submissions')
      .select('assignment_id')
      .eq('student_id', studentId);
    if (subsErr) return NextResponse.json({ error: 'subs: ' + subsErr.message }, { status: 500 });

    const assignedIds = (subs ?? []).map((s: { assignment_id: string }) => s.assignment_id);
    if (assignedIds.length > 0) {
      query = query.in('id', assignedIds);
    }
  }

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'query: ' + error.message, code: error.code, details: error.details, hint: error.hint }, { status: 500 });
  return NextResponse.json({ assignments: data });
}

// POST /api/assignments — create a new assignment
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, topic_id, problems, pdf_url, due_date } = body as Partial<Assignment>;

  if (!title || !problems?.length) {
    return NextResponse.json({ error: 'title and problems are required' }, { status: 400 });
  }

  const supabase = makeClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({ title, topic_id, problems, pdf_url, due_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data }, { status: 201 });
}
