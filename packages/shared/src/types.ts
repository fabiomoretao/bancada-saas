import type { WorkOrderStatus } from './status';

/** Contratos de resposta da API, compartilhados entre servidor e front. */

export type EstimateStatus = 'draft' | 'published' | 'approved' | 'revision_requested' | 'rejected' | 'superseded';
export type EstimateItemType = 'service' | 'part';
export type EventVisibility = 'internal' | 'customer';
export type ActorType = 'workshop' | 'customer' | 'system';

export interface EstimateItemDTO {
  id: string;
  type: EstimateItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface EstimateDTO {
  id: string;
  versionNumber: number;
  status: EstimateStatus;
  diagnosis: string;
  needsParts: boolean;
  estimatedBusinessDays: number | null;
  items: EstimateItemDTO[];
  totalCents: number;
  publishedAt: string | null;
  decisionAt: string | null;
  decisionMessage: string | null;
}

export interface WorkOrderEventDTO {
  id: string;
  actorType: ActorType;
  eventType: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus | null;
  message: string | null;
  visibility: EventVisibility;
  createdAt: string;
  /** Quem registrou, quando foi alguém da oficina (só na visão da oficina). */
  actorName?: string | null;
}

export interface InstrumentDTO {
  id: string;
  type: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
}

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface WorkOrderSummaryDTO {
  id: string;
  code: string;
  status: WorkOrderStatus;
  customerName: string;
  instrument: { type: string; brand: string | null; model: string | null };
  createdAt: string;
  expectedReadyAt: string | null;
  /** Há algo esperando a oficina (ex.: revisão pedida pelo cliente). */
  needsWorkshopAttention: boolean;
}

export interface WorkOrderListDTO {
  items: WorkOrderSummaryDTO[];
  total: number;
}

export interface WorkOrderDetailDTO {
  id: string;
  code: string;
  status: WorkOrderStatus;
  customer: CustomerDTO;
  instrument: InstrumentDTO;
  problemReport: string;
  intakeCondition: string | null;
  accessories: string | null;
  needsParts: boolean;
  expectedReadyAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  /** Última versão publicada (ou aprovada/recusada). Rascunhos não entram aqui. */
  currentEstimate: EstimateDTO | null;
  /** Rascunho em edição, se houver. */
  draftEstimate: EstimateDTO | null;
  estimateHistory: EstimateDTO[];
  events: WorkOrderEventDTO[];
  /** Caminho do link privado do cliente, ex.: /o/abc… */
  publicPath: string | null;
}

export interface CreateWorkOrderResponseDTO {
  workOrder: WorkOrderDetailDTO;
  publicPath: string;
}

/** Visão pública: nada de contato, notas internas ou número de série. */
export interface PublicWorkOrderDTO {
  code: string;
  status: WorkOrderStatus;
  workshopName: string;
  instrument: { type: string; brand: string | null; model: string | null };
  createdAt: string;
  currentEstimate: EstimateDTO | null;
  timeline: Array<Pick<WorkOrderEventDTO, 'id' | 'eventType' | 'toStatus' | 'message' | 'createdAt'>>;
  canDecide: boolean;
}

export interface CustomerMatchDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Qual dado coincidiu com o informado. */
  matchedOn: Array<'phone' | 'email'>;
}

export interface CustomerSummaryDTO extends CustomerDTO {
  instrumentCount: number;
  orderCount: number;
  lastOrderAt: string | null;
}

export interface CustomerListDTO {
  items: CustomerSummaryDTO[];
  total: number;
}

export interface CustomerInstrumentDTO extends InstrumentDTO {
  orderCount: number;
  lastOrderAt: string | null;
}

export interface CustomerDetailDTO extends CustomerDTO {
  createdAt: string;
  updatedAt: string;
  instruments: CustomerInstrumentDTO[];
  /** Ordens do cliente, mais recentes primeiro. */
  orders: Array<WorkOrderSummaryDTO & { instrumentId: string }>;
}

export interface ApiErrorDTO {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    /** Em `possible_duplicate`: cadastros com o mesmo telefone ou e-mail. */
    duplicates?: CustomerMatchDTO[];
  };
}

// ---------------- Contas e equipe ----------------

export interface SessionDTO {
  user: { id: string; name: string; email: string; role: 'owner' | 'staff' };
  workshop: { id: string; name: string };
}

export interface TeamMemberDTO {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  active: boolean;
  createdAt: string;
}

// ---------------- Instrumentos ----------------

export interface InstrumentSummaryDTO extends InstrumentDTO {
  customer: { id: string; name: string };
  orderCount: number;
  lastOrderAt: string | null;
  lastStatus: WorkOrderStatus | null;
}

export interface InstrumentListDTO {
  items: InstrumentSummaryDTO[];
  total: number;
}

export interface InstrumentDetailDTO extends InstrumentDTO {
  createdAt: string;
  customer: CustomerDTO;
  orders: WorkOrderSummaryDTO[];
}
