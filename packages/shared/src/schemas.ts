import { z } from 'zod';
import { CUSTOMER_DECISIONS, WORKSHOP_ACTIONS } from './status';

/** Texto opcional: espaços são removidos e string vazia vira `undefined`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : undefined));

const requiredText = (max: number, message: string) =>
  z.string({ error: message }).trim().min(1, message).max(max, `Use no máximo ${max} caracteres.`);

const phoneSchema = optionalText(30).refine(
  (value) => value === undefined || /^[\d\s()+-]{8,30}$/.test(value) && value.replace(/\D/g, '').length >= 8,
  'Informe um telefone com DDD, apenas números, espaços, parênteses, + ou -.',
);

const emailSchema = optionalText(160).refine(
  (value) => value === undefined || z.email().safeParse(value).success,
  'Confira o formato do e-mail.',
);

export const INSTRUMENT_TYPES = [
  'Guitarra',
  'Baixo',
  'Violão',
  'Ukulele',
  'Cavaquinho',
  'Violino',
  'Outro',
] as const;

const CONTACT_MESSAGE = 'Informe um telefone ou e-mail. Pelo menos um dos dois é necessário.';

/** Dados de contato do cliente: nome obrigatório, telefone OU e-mail (pelo menos um). */
const customerFields = {
  name: requiredText(120, 'Informe o nome do cliente.'),
  phone: phoneSchema,
  email: emailSchema,
};

function requireContact(data: { phone?: string; email?: string }, ctx: z.RefinementCtx) {
  if (!data.phone && !data.email) ctx.addIssue({ code: 'custom', path: ['contact'], message: CONTACT_MESSAGE });
}

/**
 * Cadastro ou edição de cliente. Telefone e e-mail NÃO são identificadores
 * únicos: se já aparecerem em outro cadastro, a API avisa (409) e a oficina
 * decide. Para seguir mesmo assim, reenvia com `allowDuplicate: true`.
 */
export const customerSchema = z
  .object({ ...customerFields, allowDuplicate: z.boolean().default(false) })
  .superRefine(requireContact);

export type CustomerInput = z.input<typeof customerSchema>;

export const duplicateCheckQuerySchema = z.object({
  phone: optionalText(30),
  email: optionalText(160),
  excludeId: optionalText(60),
});

export const listCustomersQuerySchema = z.object({ query: optionalText(100) });

const existingRef = (message: string) => z.string({ error: message }).trim().min(1, message).max(60);

/**
 * Criação de OS. O cliente é um cadastro existente (`mode: "existing"`) ou um
 * novo, cadastrado na abertura (`mode: "new"`). O mesmo vale para o instrumento:
 * um já cadastrado para aquele cliente ou um novo.
 */
export const createWorkOrderSchema = z.object({
  customer: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), id: existingRef('Selecione um cliente.') }),
    z
      .object({ mode: z.literal('new'), ...customerFields, allowDuplicate: z.boolean().default(false) })
      .superRefine(requireContact),
  ]),
  instrument: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), id: existingRef('Selecione o instrumento.') }),
    z.object({
      mode: z.literal('new'),
      type: requiredText(60, 'Selecione o tipo de instrumento.'),
      brand: optionalText(80),
      model: optionalText(80),
      serialNumber: optionalText(80),
    }),
  ]),
  intake: z.object({
    problemReport: requiredText(2000, 'Descreva o problema relatado pelo cliente.'),
    intakeCondition: optionalText(2000),
    accessories: optionalText(300),
  }),
});

export type CreateWorkOrderInput = z.input<typeof createWorkOrderSchema>;
export type CreateWorkOrderData = z.output<typeof createWorkOrderSchema>;

/** Normalização usada só para comparar contatos (detectar possíveis duplicidades). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2); // remove o código do Brasil
  return digits.length >= 8 ? digits : null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export const listWorkOrdersQuerySchema = z.object({
  query: optionalText(100),
  status: optionalText(40),
});

export const estimateItemSchema = z.object({
  type: z.enum(['service', 'part']),
  description: requiredText(200, 'Descreva o item.'),
  quantity: z.number().int('Use uma quantidade inteira.').min(1, 'A quantidade mínima é 1.').max(999),
  unitPriceCents: z.number().int().min(0, 'O preço não pode ser negativo.').max(100_000_000),
});

export const saveEstimateDraftSchema = z.object({
  diagnosis: requiredText(4000, 'Registre o diagnóstico.'),
  needsParts: z.boolean(),
  estimatedBusinessDays: z.number().int().min(1).max(180).optional(),
  items: z.array(estimateItemSchema).min(1, 'Inclua pelo menos um item no orçamento.'),
});

export const transitionSchema = z.object({
  action: z.enum(WORKSHOP_ACTIONS),
  message: optionalText(1000),
  visibility: z.enum(['internal', 'customer']).default('customer'),
});

export const noteSchema = z.object({
  message: requiredText(1000, 'Escreva a atualização.'),
  visibility: z.enum(['internal', 'customer']),
});

export type SaveEstimateDraftInput = z.input<typeof saveEstimateDraftSchema>;
export type TransitionInput = z.input<typeof transitionSchema>;
export type NoteInput = z.input<typeof noteSchema>;
export type CustomerDecisionInput = z.input<typeof customerDecisionSchema>;

export const customerDecisionSchema = z
  .object({
    decision: z.enum(CUSTOMER_DECISIONS),
    versionNumber: z.number().int().min(1),
    message: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    if (data.decision === 'request_revision' && !data.message) {
      ctx.addIssue({
        code: 'custom',
        path: ['message'],
        message: 'Conte à oficina o que gostaria de ajustar.',
      });
    }
  });

// ---------------- Contas, login e equipe ----------------

export const USER_ROLES = ['owner', 'staff'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const ROLE_LABELS: Record<UserRole, string> = { owner: 'Responsável', staff: 'Técnico' };

const loginEmail = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .max(160)
  .pipe(z.email('Confira o formato do e-mail.'));

/** Senha: 8 a 128 caracteres. Sem regras de composição; o comprimento é o que mais protege. */
const newPassword = z
  .string({ error: 'Crie uma senha.' })
  .min(8, 'Use pelo menos 8 caracteres.')
  .max(128, 'Use no máximo 128 caracteres.');

export const signupSchema = z.object({
  workshopName: requiredText(120, 'Informe o nome da oficina.'),
  name: requiredText(120, 'Informe seu nome.'),
  email: loginEmail,
  password: newPassword,
});

export const loginSchema = z.object({
  email: loginEmail,
  password: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(128),
});

export const createUserSchema = z.object({
  name: requiredText(120, 'Informe o nome.'),
  email: loginEmail,
  password: newPassword,
  role: z.enum(USER_ROLES).default('staff'),
});

export const updateUserSchema = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.active !== undefined, 'Nada para alterar.');

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.').max(128),
  newPassword: newPassword,
});

export type SignupInput = z.input<typeof signupSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type CreateUserInput = z.input<typeof createUserSchema>;
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const listInstrumentsQuerySchema = z.object({ query: optionalText(100) });
