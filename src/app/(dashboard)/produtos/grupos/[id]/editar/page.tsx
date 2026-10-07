import CategoryForm from '@/components/produtos/category-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Grupo de Produto - CRManager',
};

export default async function EditarGrupoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <CategoryForm categoryId={resolvedParams.id} />;
}
