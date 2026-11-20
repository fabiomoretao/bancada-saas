import type { ColumnType, Insertable, Selectable } from 'kysely';
import type {
  ActorType,
  BillingCycle,
  EstimateItemType,
  EstimateStatus,
  EventVisibility,
  PlanId,
  WorkOrderStatus,
} from '@bancada/shared';

/**
 * Tipos das tabelas. As colunas no banco são snake_case; o CamelCasePlugin do
 * Kysely converte para camelCase no código.
 *
 * Convenções portáveis entre SQLite e PostgreSQL:
 * - IDs: texto (UUID gerado na aplicação).
 * - Datas: texto ISO 8601 em UTC (ordena corretamente nos dois bancos).
 * - Booleanos: inteiro 0/1.
 * - Dinheiro: inteiro em centavos.
 */

type Bool = ColumnType<number, number, number>;

export interface WorkshopTable {
  id: string;
  name: string;
  nextOrderNumber: number;
  plan: ColumnType<PlanId, PlanId | undefined, PlanId>;
  billingCycle: ColumnType<BillingCycle, BillingCycle | undefined, BillingCycle>;
  planChangedAt: ColumnType<string | null, string | null | undefined, string | null>;
  createdAt: string;
}

export interface CustomerTable {
  id: string;
  workshopId: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** Telefone só com dígitos e e-mail em minúsculas: usados para buscar e detectar duplicidade (não são únicos). */
  phoneDigits: string | null;
  emailNormalized: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstrumentTable {
  id: string;
  workshopId: string;
  customerId: string;
  type: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  createdAt: string;
}

export interface WorkOrderTable {
  id: string;
  workshopId: string;
  customerId: string;
  instrumentId: string;
  code: string;
  problemReport: string;
  intakeCondition: string | null;
  accessories: string | null;
  status: WorkOrderStatus;
  needsParts: Bool;
  expectedReadyAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface EstimateVersionTable {
  id: string;
  workOrderId: string;
  versionNumber: number;
  diagnosis: string;
  status: EstimateStatus;
  currency: string;
  needsParts: Bool;
  estimatedBusinessDays: number | null;
  totalCents: number;
  createdAt: string;
  publishedAt: string | null;
  decisionAt: string | null;
  decisionMessage: string | null;
}

export interface EstimateItemTable {
  id: string;
  estimateVersionId: string;
  position: number;
  type: EstimateItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface WorkOrderEventTable {
  id: string;
  workOrderId: string;
  actorType: ActorType;
  eventType: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus | null;
  message: string | null;
  visibility: EventVisibility;
  /** Chave opcional para evitar eventos duplicados quando a mesma ação é reenviada. */
  idempotencyKey: string | null;
  /** Usuário da oficina que fez a ação (nulo para cliente ou sistema). */
  actorUserId?: string | null;
  createdAt: string;
}

export interface UserTable {
  id: string;
  workshopId: string;
  name: string;
  /** Sempre em minúsculas. Único no sistema. */
  email: string;
  /** scrypt: "scrypt$N$r$p$salt$hash" (nunca a senha). */
  passwordHash: string;
  role: 'owner' | 'staff';
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface SessionTable {
  id: string;
  userId: string;
  /** SHA-256 do token do cookie; o token em si nunca é guardado. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
}

export interface PublicAccessTokenTable {
  id: string;
  workOrderId: string;
  tokenHash: string;
  /** Token cifrado (AES-256-GCM) para a oficina copiar o link de novo. Nunca em texto puro. */
  tokenEncrypted: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface Database {
  workshops: WorkshopTable;
  customers: CustomerTable;
  instruments: InstrumentTable;
  workOrders: WorkOrderTable;
  estimateVersions: EstimateVersionTable;
  estimateItems: EstimateItemTable;
  workOrderEvents: WorkOrderEventTable;
  publicAccessTokens: PublicAccessTokenTable;
  users: UserTable;
  sessions: SessionTable;
}

export type WorkOrderRow = Selectable<WorkOrderTable>;
export type EstimateVersionRow = Selectable<EstimateVersionTable>;
export type EstimateItemRow = Selectable<EstimateItemTable>;
export type WorkOrderEventRow = Selectable<WorkOrderEventTable>;
export type NewWorkOrderEvent = Insertable<WorkOrderEventTable>;
