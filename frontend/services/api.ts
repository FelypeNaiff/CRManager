import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

export const withAuth = (token: string, lojaId: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'x-loja-id': lojaId,
  },
});
