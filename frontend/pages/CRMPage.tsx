import { useCustomers } from '../hooks/useCustomers';

export const CRMPage = () => {
  const { data, isLoading } = useCustomers();

  if (isLoading) return <p>Carregando clientes...</p>;

  return (
    <section className="bg-white shadow rounded-xl p-4">
      <h2 className="text-xl font-semibold mb-3">Clientes</h2>
      <ul className="space-y-2">
        {(data ?? []).map((customer: any) => (
          <li key={customer.phone} className="border p-2 rounded">
            {customer.name} - {customer.phone} ({customer.segment})
          </li>
        ))}
      </ul>
    </section>
  );
};
