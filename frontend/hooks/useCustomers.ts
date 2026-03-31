import { useQuery } from '@tanstack/react-query';
import { api, withAuth } from '../services/api';
import { useAuthStore } from '../store/auth.store';

export const useCustomers = () => {
  const { token, lojaId } = useAuthStore();

  return useQuery({
    queryKey: ['customers', lojaId],
    queryFn: async () => {
      const { data } = await api.get('/crm/customers', withAuth(token, lojaId));
      return data;
    },
    enabled: Boolean(token && lojaId),
  });
};
