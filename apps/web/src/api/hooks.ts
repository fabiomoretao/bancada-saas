import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalizeEmail, normalizePhone } from '@bancada/shared';
import type {
  ChangePasswordInput,
  ChangePlanInput,
  WorkshopPlanDTO,
  CreateUserInput,
  InstrumentDetailDTO,
  InstrumentListDTO,
  LoginInput,
  SessionDTO,
  SignupInput,
  TeamMemberDTO,
  UpdateUserInput,
  CustomerDetailDTO,
  CustomerDTO,
  CustomerInput,
  CustomerListDTO,
  CustomerMatchDTO,
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
import { api, ApiError, postJson } from './client';

/** Estado de servidor: fica todo aqui, separado do estado dos formulários. */

export const queryKeys = {
  workOrders: (filters: { query: string; status: string }) => ['work-orders', filters] as const,
  workOrder: (id: string) => ['work-order', id] as const,
  publicOrder: (token: string) => ['public-order', token] as const,
  customers: (query: string) => ['customers', query] as const,
  customer: (id: string) => ['customer', id] as const,
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
      await client.invalidateQueries({ queryKey: ['customers'] });
      await client.invalidateQueries({ queryKey: ['customer'] });
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

// ---------------- Clientes ----------------

export function useCustomers(query: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.customers(query),
    queryFn: () => api<CustomerListDTO>(`/customers${query ? `?query=${encodeURIComponent(query)}` : ''}`),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ''),
    queryFn: () => api<CustomerDetailDTO>(`/customers/${id}`),
    enabled: Boolean(id),
  });
}

/**
 * Cadastros com o mesmo telefone ou e-mail, consultados enquanto a pessoa
 * digita. É só um aviso: não bloqueia o formulário.
 */
export function useContactDuplicates(contact: { phone?: string; email?: string; excludeId?: string }) {
  const phone = normalizePhone(contact.phone) ? contact.phone!.trim() : '';
  const email = normalizeEmail(contact.email)?.includes('@') ? contact.email!.trim() : '';
  const params = new URLSearchParams();
  if (phone) params.set('phone', phone);
  if (email) params.set('email', email);
  if (contact.excludeId) params.set('excludeId', contact.excludeId);
  return useQuery({
    queryKey: ['customer-duplicates', phone, email, contact.excludeId ?? ''],
    queryFn: () => api<{ items: CustomerMatchDTO[] }>(`/customers/duplicates?${params}`),
    enabled: Boolean(phone || email),
    staleTime: 10_000,
  });
}

export function useSaveCustomer(id?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) =>
      id
        ? api<CustomerDetailDTO>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(input) })
        : postJson<CustomerDTO>('/customers', input),
    onSuccess: async (customer) => {
      if (id) client.setQueryData(queryKeys.customer(id), customer);
      await client.invalidateQueries({ queryKey: ['customers'] });
      await client.invalidateQueries({ queryKey: ['customer-duplicates'] });
      // O nome do cliente aparece na fila e nos detalhes das ordens.
      await client.invalidateQueries({ queryKey: ['work-orders'] });
      await client.invalidateQueries({ queryKey: ['work-order'] });
      return customer;
    },
  });
}

// ---------------- Sessão, conta e equipe ----------------

export const SESSION_KEY = ['session'] as const;

/** Sessão atual. `null` = não está logado (o 401 vira null, não erro). */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await api<SessionDTO>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

function useSessionMutation<TInput>(request: (input: TInput) => Promise<SessionDTO>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (session) => {
      // Outra conta pode ter outra oficina: nada do cache anterior vale.
      client.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
      client.setQueryData(SESSION_KEY, session);
    },
  });
}

export const useLogin = () => useSessionMutation((input: LoginInput) => postJson<SessionDTO>('/auth/login', input));
export const useSignup = () => useSessionMutation((input: SignupInput) => postJson<SessionDTO>('/auth/signup', input));

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      client.clear();
      client.setQueryData(SESSION_KEY, null);
    },
  });
}

export const useChangePassword = () =>
  useMutation({ mutationFn: (input: ChangePasswordInput) => postJson<void>('/auth/password', input) });

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: () => api<{ items: TeamMemberDTO[] }>('/team') });
}

/** Mudanças na equipe alteram os acessos em uso do plano. */
function invalidateTeam(client: ReturnType<typeof useQueryClient>) {
  return Promise.all([client.invalidateQueries({ queryKey: ['team'] }), client.invalidateQueries({ queryKey: PLAN_KEY })]);
}

export function useCreateMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => postJson<TeamMemberDTO>('/team', input),
    onSuccess: () => invalidateTeam(client),
  });
}

export function useUpdateMember() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: string }) =>
      api<TeamMemberDTO>(`/team/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => invalidateTeam(client),
  });
}

// ---------------- Plano da oficina ----------------

export const PLAN_KEY = ['plan'] as const;

export function usePlan() {
  return useQuery({ queryKey: PLAN_KEY, queryFn: () => api<WorkshopPlanDTO>('/workshop/plan') });
}

export function useChangePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangePlanInput) => api<WorkshopPlanDTO>('/workshop/plan', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (plan) => {
      client.setQueryData(PLAN_KEY, plan);
      return client.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

// ---------------- Instrumentos ----------------

export function useInstruments(query: string) {
  return useQuery({
    queryKey: ['instruments', query],
    queryFn: () => api<InstrumentListDTO>(`/instruments${query ? `?query=${encodeURIComponent(query)}` : ''}`),
    placeholderData: keepPreviousData,
  });
}

export function useInstrument(id: string | undefined) {
  return useQuery({
    queryKey: ['instrument', id ?? ''],
    queryFn: () => api<InstrumentDetailDTO>(`/instruments/${id}`),
    enabled: Boolean(id),
  });
}
