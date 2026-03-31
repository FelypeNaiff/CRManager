interface Props {
  title: string;
  value: string;
}

export const KpiCard = ({ title, value }: Props) => (
  <div className="bg-white shadow rounded-xl p-4">
    <p className="text-sm text-slate-500">{title}</p>
    <h3 className="text-2xl font-bold">{value}</h3>
  </div>
);
