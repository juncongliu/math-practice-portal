import { createClient as _createClient } from '@supabase/supabase-js';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return _createClient(supabaseUrl, supabaseKey);
}

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return _createClient(supabaseUrl, supabaseKey);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Problem {
  id: string;
  text: string;
  answer: string;
  points: number;
}

export interface AnswerEntry {
  problem_id: string;
  student_answer: string;
  is_correct: boolean | null;
  grade_status: 'auto' | 'manual' | 'pending';
}

export interface Assignment {
  id: string;
  title: string;
  topic_id: string | null;
  problems: Problem[];
  pdf_url: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  answers: AnswerEntry[];
  auto_score: number;
  final_score: number | null;
  status: 'pending_review' | 'reviewed' | 'auto_graded_only';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  parent_id: string | null;
  grade: number;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
}
