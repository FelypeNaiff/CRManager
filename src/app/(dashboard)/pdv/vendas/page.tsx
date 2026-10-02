import { SalesListPage } from '../../comercial/vendas/page';

export default function PdvSalesPage() {
  return (
    <SalesListPage
      channel="COUNTER"
      title="Vendas Balcão - PDV"
      newSaleHref="/pdv"
      newSaleLabel="Nova venda de balcão"
    />
  );
}
