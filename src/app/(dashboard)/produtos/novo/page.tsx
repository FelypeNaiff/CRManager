import ProductForm from '@/components/produtos/product-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Novo Produto - CRManager',
};

export default function NovoProdutoPage() {
  return <ProductForm />;
}
