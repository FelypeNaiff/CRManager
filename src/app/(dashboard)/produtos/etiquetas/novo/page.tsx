import LabelForm from '@/components/produtos/label-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nova Etiqueta - CRManager',
};

export default function NovaEtiquetaPage() {
  return <LabelForm />;
}
