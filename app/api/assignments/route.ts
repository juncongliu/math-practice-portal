import { NextRequest, NextResponse } from 'next/server';
import { supabase, type Assignment } from '@/lib/supabase';

// GET /api/assignments — list assignments (filtered by student or parent)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get('student_id');
  const topicId = searchParams.get('topic_id');

  let query = supabase.from('assignments').select('*').order('created_at', { ascending: false });

  if (studentId) {
    // Fetch assignments for a specific student (via submissions)
    const { data: subs } = await supabase
      .from('submissions')
      .select('assignment_id')
      .eq('student_id', studentId);

    const assignedIds = subs?.map((s) => s.assignment_id) ?? [];
    if (assignedIds.length > 0) {
      query = query.in('id', assignedIds);
    }
  }

  if (topicId) {
    query = query.eq('topic_id', topicId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignments: data });
}

// POST /api/assignments — create a new assignment
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, topic_id, problems, pdf_url, due_date } = body as Partial<Assignment>;

  if (!title || !problems?.length) {
    return NextResponse.json({ error: 'title and problems are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('assignments')
    .insert({ title, topic_id, problems, pdf_url, due_date })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assignment: data }, { status: 201 });
}
