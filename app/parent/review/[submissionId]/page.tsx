import { makeServerClient } from '@/lib/supabase';
import ReviewForm from '@/components/ReviewForm';
import type { PageProps } from '@/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  return { title: 'Review Submission' };
}

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const submissionId = params?.submissionId as string;
  const parentId = searchParams?.parent_id as string;

  if (!submissionId || !parentId) {
    return <div className="p-6 text-red-600">Missing parameters</div>;
  }

  const supabase = makeServerClient();
  const { data: submission } = await supabase
    .from('submissions')
    .select('*, student:students(name), assignment:assignments(title, problems)')
    .eq('id', submissionId)
    .single();

  if (!submission) {
    return <div className="p-6 text-red-600">Submission not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ReviewForm submission={submission as any} parentId={parentId} />
    </div>
  );
}
