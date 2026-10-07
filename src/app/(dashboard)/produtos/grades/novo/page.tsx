import GradeForm from '@/components/produtos/grade-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova Grade - CRManager',
};

export default function NovaGradePage() {
  return <GradeForm />;
}
