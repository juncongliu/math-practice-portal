-- Math Practice Portal — Supabase Schema
-- Run this in the Supabase SQL editor

-- ─── Students ────────────────────────────────────────────────────────────────
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text unique not null,
  parent_id   uuid references public.parents(id),
  grade       smallint check (grade between 9 and 12),
  created_at  timestamptz default now()
);

-- ─── Parents ─────────────────────────────────────────────────────────────────
create table if not exists public.parents (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text unique not null,
  created_at timestamptz default now()
);

-- ─── Assignments ─────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  topic_id    text,
  problems    jsonb not null default '[]',
  -- problems: [{ id: "p1", text: "...", answer: "...", points: 1 }, ...]
  pdf_url     text,
  due_date    timestamptz,
  created_by  uuid references public.parents(id),
  created_at  timestamptz default now()
);

-- ─── Submissions ───────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id              uuid primary key default gen_random_uuid(),
  assignment_id   uuid references public.assignments(id) on delete cascade,
  student_id      uuid references public.students(id) on delete cascade,
  answers         jsonb not null default '[]',
  -- answers: [{ problem_id: "p1", student_answer: "2", is_correct: true|null, grade_status: "auto"|"manual"|"pending" }, ...]
  auto_score      smallint default 0,
  final_score     smallint,
  status          text not null default 'pending_review'
    check (status in ('pending_review', 'reviewed', 'auto_graded_only')),
  submitted_at    timestamptz default now(),
  reviewed_by     uuid references public.parents(id),
  reviewed_at     timestamptz,
  notes           text
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.students      enable row level security;
alter table public.parents       enable row level security;
alter table public.assignments   enable row level security;
alter table public.submissions   enable row level security;

-- Parents manage everything
create policy "parents_full_access" on public.parents for all using (true);
create policy "parents_full_access" on public.students for all using (true);
create policy "parents_full_access" on public.assignments for all using (true);
create policy "parents_full_access" on public.submissions for all using (true);

-- Students can view their own assignments and submit
create policy "students_view_own_assignments"
  on public.assignments for select
  using (exists (
    select 1 from public.students s
    where s.id = auth.uid() and s.parent_id = parent_id
  ));

create policy "students_submit"
  on public.submissions for insert
  with check (student_id = auth.uid());

create policy "students_view_own_submissions"
  on public.submissions for select
  using (student_id = auth.uid());

-- ─── Useful indexes ───────────────────────────────────────────────────────────
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_submissions_student    on public.submissions(student_id);
create index if not exists idx_submissions_status     on public.submissions(status);
create index if not exists idx_assignments_topic      on public.assignments(topic_id);
