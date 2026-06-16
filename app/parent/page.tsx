import { makeServerClient } from '@/lib/supabase';
import type { PageProps } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Review Queue' };

export default async function ParentDashboard({ searchParams }: PageProps) {
  const parentId = searchParams?.parent_id as string;
  if (!parentId) return <div className="p-6 text-red-600">Missing parent_id</div>;

  const supabase = makeServerClient();

  // Fetch pending review submissions
  const { data: pending } = await supabase
    .from('submissions')
    .select('*, student:students(name), assignment:assignments(title, problems)')
    .eq('status', 'pending_review')
    .order('submitted_at', { ascending: true });

  // Fetch already reviewed
  const { data: reviewed } = await supabase
    .from('submissions')
    .select('*, student:students(name), assignment:assignments(title)')
    .eq('status', 'reviewed')
    .order('reviewed_at', { ascending: false })
    .limit(20);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🔍 Review Queue</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3 text-yellow-700">
          ⏳ Pending Review ({pending?.length ?? 0})
        </h2>
        {(!pending || pending.length === 0) ? (
          <p className="text-gray-400 border rounded p-4">All caught up! No pending reviews.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((sub) => (
              <a
                key={sub.id}
                href={`/parent/review/${sub.id}?parent_id=${parentId}`}
                className="block border border-yellow-300 bg-yellow-50 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{sub.assignment?.title}</p>
                    <p className="text-sm text-gray-600">Student: {sub.student?.name}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{new Date(sub.submitted_at).toLocaleDateString()}</p>
                    <p className="text-yellow-700 font-medium">
                      {sub.auto_score}/{sub.assignment?.problems?.length} auto-graded
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-700">
          ✅ Recently Reviewed ({reviewed?.length ?? 0})
        </h2>
        {(!reviewed || reviewed.length === 0) ? (
          <p className="text-gray-400 border rounded p-4">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviewed.map((sub) => (
              <div key={sub.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{sub.assignment?.title}</p>
                  <span className="text-sm text-green-700 font-medium">
                    {sub.final_score}/{sub.assignment?.problems?.length}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {sub.student?.name} · reviewed {new Date(sub.reviewed_at!).toLocaleDateString()}
                </p>
                {sub.notes && <p className="text-sm mt-1 italic text-gray-600">💬 {sub.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
