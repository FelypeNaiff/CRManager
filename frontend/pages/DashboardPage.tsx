import { KpiCard } from '../components/KpiCard';

export const DashboardPage = () => {
  return (
    <section className="grid md:grid-cols-3 gap-4">
      <KpiCard title="Custo por Lead" value="R$ 28,30" />
      <KpiCard title="Custo por Venda" value="R$ 82,00" />
      <KpiCard title="ROI" value="245%" />
    </section>
  );
};
