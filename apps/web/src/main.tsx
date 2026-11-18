import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './styles/global.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AppShell } from './layout/AppShell';
import { EstimatePage } from './pages/EstimatePage';
import { NewOrderPage } from './pages/NewOrderPage';
import { NotFoundPage, PlaceholderPage } from './pages/PlaceholderPage';
import { PublicOrderPage } from './pages/PublicOrderPage';
import { QueuePage } from './pages/QueuePage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true } },
});

const router = createBrowserRouter([
  {
    // Área da oficina (modo demonstração, sem login)
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/ordens" replace /> },
      { path: 'ordens', element: <QueuePage /> },
      { path: 'ordens/nova', element: <NewOrderPage /> },
      { path: 'ordens/:id', element: <QueuePage /> },
      { path: 'ordens/:id/orcamento', element: <EstimatePage /> },
      {
        path: 'clientes',
        element: <PlaceholderPage title="Clientes" description="Consulta de clientes com o histórico de ordens de cada um." />,
      },
      {
        path: 'instrumentos',
        element: <PlaceholderPage title="Instrumentos" description="Consulta de instrumentos com o histórico de reparos." />,
      },
    ],
  },
  // Link privado do cliente: fora do shell da oficina
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
