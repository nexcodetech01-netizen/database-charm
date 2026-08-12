import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: ({ location }) => {
    // No ambiente de preview do Lovable, evitamos o throw redirect que pode causar 502
    // se o middleware de auth ainda não tiver injetado a sessão.
    if (typeof window !== 'undefined' && window.location.hostname.includes('lovable.app')) {
      if (location.pathname === '/') {
        window.location.href = '/dashboard';
        return;
      }
    }
    
    throw redirect({
      to: '/dashboard',
    });
  },
  loader: () => {
    throw redirect({
      to: '/dashboard',
    });
  },
  component: () => null,
});