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

/**
 * Criação de OS. Nome, tipo de instrumento e relato são obrigatórios;
 * telefone e e-mail são opcionais isoladamente, mas pelo menos um é exigido.
 */
export const createWorkOrderSchema = z
  .object({
    customer: z.object({
      name: requiredText(120, 'Informe o nome do cliente.'),
      phone: phoneSchema,
      email: emailSchema,
    }),
    instrument: z.object({
      type: requiredText(60, 'Selecione o tipo de instrumento.'),
      brand: optionalText(80),
      model: optionalText(80),
      serialNumber: optionalText(80),
    }),
    intake: z.object({
      problemReport: requiredText(2000, 'Descreva o problema relatado pelo cliente.'),
      intakeCondition: optionalText(2000),
      accessories: optionalText(300),
    }),
  })
  .superRefine((data, ctx) => {
    if (!data.customer.phone && !data.customer.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['customer', 'contact'],
        message: 'Informe um telefone ou e-mail. Pelo menos um dos dois é necessário.',
      });
    }
  });

export type CreateWorkOrderInput = z.input<typeof createWorkOrderSchema>;
export type CreateWorkOrderData = z.output<typeof createWorkOrderSchema>;

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
