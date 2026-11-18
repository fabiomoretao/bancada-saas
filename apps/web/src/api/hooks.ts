import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CustomerDecisionInput,
  NoteInput,
  SaveEstimateDraftInput,
  TransitionInput,
  CreateWorkOrderInput,
  CreateWorkOrderResponseDTO,
  PublicWorkOrderDTO,
  WorkOrderDetailDTO,
  WorkOrderListDTO,
} from '@bancada/shared';
import { api, postJson } from './client';

/** Estado de servidor: fica todo aqui, separado do estado dos formulários. */

export const queryKeys = {
  workOrders: (filters: { query: string; status: string }) => ['work-orders', filters] as const,
  workOrder: (id: string) => ['work-order', id] as const,
  publicOrder: (token: string) => ['public-order', token] as const,
};

export function useWorkOrders(filters: { query: string; status: string }) {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.status) params.set('status', filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.workOrders(filters),
    queryFn: () => api<WorkOrderListDTO>(`/work-orders${qs ? `?${qs}` : ''}`),
    placeholderData: keepPreviousData,
  });
}

export function useWorkOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.workOrder(id ?? ''),
    queryFn: () => api<WorkOrderDetailDTO>(`/work-orders/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateWorkOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkOrderInput) => postJson<CreateWorkOrderResponseDTO>('/work-orders', input),
    onSuccess: async (data) => {
      client.setQueryData(queryKeys.workOrder(data.workOrder.id), data.workOrder);
      await client.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

export function useRegeneratePublicLink(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => postJson<{ publicPath: string }>(`/work-orders/${id}/public-link`),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.workOrder(id) }),
  });
}

export function usePublicOrder(token: string) {
  return useQuery({
    queryKey: queryKeys.publicOrder(token),
    queryFn: () => api<PublicWorkOrderDTO>(`/public/orders/${encodeURIComponent(token)}`),
    retry: false,
  });
}

/** Mutação da oficina que devolve a OS atualizada: atualiza o cache do detalhe e recarrega a fila. */
function useWorkOrderMutation<TInput>(id: string, request: (input: TInput) => Promise<WorkOrderDetailDTO>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: async (order) => {
      client.setQueryData(queryKeys.workOrder(id), order);
      await client.invalidateQueries({ queryKey: ['work-orders'] });
    },
  });
}

export const useTransition = (id: string) =>
  useWorkOrderMutation(id, (input: TransitionInput) => postJson<WorkOrderDetailDTO>(`/work-orders/${id}/transitions`, input));

export const useAddNote = (id: string) =>
  useWorkOrderMutation(id, (input: NoteInput) => postJson<WorkOrderDetailDTO>(`/work-orders/${id}/events`, input));

export const useSaveDraft = (id: string) =>
  useWorkOrderMutation(id, (input: SaveEstimateDraftInput) =>
    api<WorkOrderDetailDTO>(`/work-orders/${id}/estimates/draft`, { method: 'PUT', body: JSON.stringify(input) }),
  );

export const useDiscardDraft = (id: string) =>
  useWorkOrderMutation(id, () => api<WorkOrderDetailDTO>(`/work-orders/${id}/estimates/draft`, { method: 'DELETE' }));

export const usePublishEstimate = (id: string) =>
  useWorkOrderMutation(id, (version: number) => postJson<WorkOrderDetailDTO>(`/work-orders/${id}/estimates/${version}/publish`));

export function useCustomerDecision(token: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerDecisionInput) =>
      postJson<PublicWorkOrderDTO>(`/public/orders/${encodeURIComponent(token)}/decision`, input),
    onSuccess: (order) => client.setQueryData(queryKeys.publicOrder(token), order),
  });
}
