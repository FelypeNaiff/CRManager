import LabelForm from '@/components/produtos/label-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Etiqueta - CRManager',
};

export default async function EditarEtiquetaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <LabelForm templateId={resolvedParams.id} />;
}
