import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './styles/global.css';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { SESSION_KEY } from './api/hooks';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AppShell } from './layout/AppShell';
import { EstimatePage } from './pages/EstimatePage';
import { CustomersPage } from './pages/CustomersPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { InstrumentsPage } from './pages/InstrumentsPage';
import { NotFoundPage } from './pages/PlaceholderPage';
import { TeamPage } from './pages/TeamPage';
import { PublicOrderPage } from './pages/PublicOrderPage';
import { QueuePage } from './pages/QueuePage';

/** Sessão expirada ou encerrada no meio do uso: volta para a tela de entrar. */
function handleUnauthenticated(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && error.code === 'unauthenticated') {
    queryClient.setQueryData(SESSION_KEY, null);
  }
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleUnauthenticated }),
  mutationCache: new MutationCache({ onError: handleUnauthenticated }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const router = createBrowserRouter([
  {
    // Área da oficina: exige login (o AppShell redireciona para /entrar)
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/ordens" replace /> },
      { path: 'ordens', element: <QueuePage /> },
      { path: 'ordens/nova', element: <NewOrderPage /> },
      { path: 'ordens/:id', element: <QueuePage /> },
      { path: 'ordens/:id/orcamento', element: <EstimatePage /> },
      { path: 'clientes', element: <CustomersPage /> },
      { path: 'clientes/novo', element: <CustomersPage creating /> },
      { path: 'clientes/:id', element: <CustomersPage /> },
      { path: 'instrumentos', element: <InstrumentsPage /> },
      { path: 'instrumentos/:id', element: <InstrumentsPage /> },
      { path: 'equipe', element: <TeamPage /> },
    ],
  },
  { path: 'entrar', element: <LoginPage /> },
  { path: 'criar-conta', element: <SignupPage /> },
  // Link privado do cliente: fora do shell da oficina, sem conta
  { path: 'o/:token', element: <PublicOrderPage /> },
  { path: '*', element: <NotFoundPage /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
