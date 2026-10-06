import CategoryForm from '@/components/produtos/category-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Novo Grupo de Produto - CRManager',
};

export default function NovoGrupoPage() {
  return <CategoryForm />;
}
