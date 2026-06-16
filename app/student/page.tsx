import { makeServerClient } from '@/lib/supabase';
import type { PageProps } from '@/types';

export const metadata = { title: 'My Practice' };

export default async function StudentDashboard({ searchParams }: PageProps) {
  const studentId = searchParams?.student_id as string;

  if (!studentId) {
    return <div className="p-6 text-red-600">Missing student_id</div>;
  }

  const supabase = makeServerClient();

  // Fetch assignments this student has submitted
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*, assignment:assignments(id, title, problems, topic_id)')
    .eq('student_id', studentId)
    .order('submitted_at', { ascending: false });

  // Fetch available (unstarted) assignments
  const submittedIds = (submissions ?? []).map((s) => s.assignment_id);
  const { data: available } = await supabase
    .from('assignments')
    .select('*')
    .not('id', 'in', submittedIds.length > 0 ? submittedIds : ['dummy'])
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📐 My Practice</h1>

      {available && available.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">Available Worksheets</h2>
          <div className="space-y-3">
            {available.map((a) => (
              <a
                key={a.id}
                href={`/student/${a.id}?student_id=${studentId}`}
                className="block border rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition"
              >
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-gray-500">{a.problems?.length ?? 0} problems</p>
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-700">My Submissions</h2>
        {(!submissions || submissions.length === 0) ? (
          <p className="text-gray-400">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((sub) => (
              <div key={sub.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{sub.assignment?.title}</p>
                  <span
                    className={`text-sm px-2 py-0.5 rounded-full ${
                      sub.status === 'reviewed'
                        ? 'bg-green-100 text-green-800'
                        : sub.status === 'pending_review'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {sub.status === 'reviewed'
                      ? `Reviewed: ${sub.final_score ?? sub.auto_score}/${sub.assignment?.problems?.length ?? '?'}`
                      : sub.status === 'pending_review'
                      ? 'Pending review'
                      : `Auto: ${sub.auto_score}/${sub.assignment?.problems?.length ?? '?'}`}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                </p>
                {sub.notes && (
                  <p className="text-sm mt-2 italic text-gray-600">💬 {sub.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
