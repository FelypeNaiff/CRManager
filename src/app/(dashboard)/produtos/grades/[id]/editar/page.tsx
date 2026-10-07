import GradeForm from '@/components/produtos/grade-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Grade - CRManager',
};

export default async function EditarGradePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <GradeForm gradeId={resolvedParams.id} />;
}
