import { PropsWithChildren } from 'react';

export const MainLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white p-4 font-semibold">CRManager</header>
      <main className="p-6">{children}</main>
    </div>
  );
};
