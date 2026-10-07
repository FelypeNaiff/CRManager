import ProductForm from '@/components/produtos/product-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Editar Produto - CRManager',
};

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) return <div>ID do produto inválido.</div>;
  return <ProductForm productId={resolvedParams.id} />;
}
