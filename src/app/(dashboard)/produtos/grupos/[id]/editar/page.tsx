import CategoryForm from '@/components/produtos/category-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Grupo de Produto - CRManager',
};

export default function EditarGrupoPage({ params }: { params: { id: string } }) {
  return <CategoryForm categoryId={params.id} />;
}
