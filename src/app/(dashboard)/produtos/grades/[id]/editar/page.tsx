import GradeForm from '@/components/produtos/grade-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Grade - CRManager',
};

export default function EditarGradePage({ params }: { params: { id: string } }) {
  return <GradeForm gradeId={params.id} />;
}
