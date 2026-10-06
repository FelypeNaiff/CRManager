import LabelForm from '@/components/produtos/label-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Etiqueta - CRManager',
};

export default function EditarEtiquetaPage({ params }: { params: { id: string } }) {
  return <LabelForm templateId={params.id} />;
}
