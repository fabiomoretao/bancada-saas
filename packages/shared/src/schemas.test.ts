import { describe, expect, it } from 'vitest';
import { createWorkOrderSchema, customerDecisionSchema, customerSchema, normalizeEmail, normalizePhone } from './schemas';
import { formatCents, toCents, totalCents } from './money';

const base = {
  customer: { mode: 'new' as const, name: 'Alex Ribeiro', phone: '', email: '' },
  instrument: { mode: 'new' as const, type: 'Baixo', brand: 'Aurora', model: 'JB', serialNumber: '' },
  intake: { problemReport: 'Jack com contato instável', intakeCondition: '', accessories: '' },
};

const withContact = (phone: string, email: string) => ({ ...base, customer: { ...base.customer, phone, email } });

describe('criação de OS', () => {
  it('aceita só telefone (critério 1)', () => {
    expect(createWorkOrderSchema.safeParse(withContact('(11) 98888-1234', '')).success).toBe(true);
  });

  it('aceita só e-mail (critério 2)', () => {
    expect(createWorkOrderSchema.safeParse(withContact('', 'alex@example.com')).success).toBe(true);
  });

  it('bloqueia sem telefone e sem e-mail, apontando o grupo de contato (critério 3)', () => {
    const result = createWorkOrderSchema.safeParse(withContact('', ''));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('customer.contact');
  });

  it('bloqueia nome, tipo ou relato vazios (critério 4)', () => {
    const cases = [
      { ...withContact('11988881234', ''), customer: { mode: 'new' as const, name: '  ', phone: '11988881234', email: '' } },
      { ...withContact('11988881234', ''), instrument: { ...base.instrument, type: '' } },
      { ...withContact('11988881234', ''), intake: { ...base.intake, problemReport: '' } },
    ];
    for (const input of cases) expect(createWorkOrderSchema.safeParse(input).success).toBe(false);
  });

  it('normaliza campos opcionais vazios para undefined', () => {
    const result = createWorkOrderSchema.parse(withContact('11988881234', ''));
    expect(result.customer.mode === 'new' && result.customer.email).toBeUndefined();
    expect(result.instrument.mode === 'new' && result.instrument.serialNumber).toBeUndefined();
  });

  it('rejeita e-mail malformado', () => {
    expect(createWorkOrderSchema.safeParse(withContact('', 'alex@')).success).toBe(false);
  });
});

describe('cliente existente na abertura da OS', () => {
  it('aceita cliente e instrumento já cadastrados, sem exigir contato', () => {
    const input = { ...base, customer: { mode: 'existing', id: 'c1' }, instrument: { mode: 'existing', id: 'i1' } };
    expect(createWorkOrderSchema.safeParse(input).success).toBe(true);
  });

  it('cliente existente com instrumento novo exige o tipo', () => {
    const input = { ...base, customer: { mode: 'existing', id: 'c1' }, instrument: { mode: 'new', type: '' } };
    expect(createWorkOrderSchema.safeParse(input).success).toBe(false);
  });

  it('cadastro de cliente também exige telefone ou e-mail', () => {
    const r = customerSchema.safeParse({ name: 'Ana', phone: '', email: '' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['contact']);
    expect(customerSchema.parse({ name: 'Ana', email: 'ANA@x.com' }).allowDuplicate).toBe(false);
  });
});

describe('normalização de contato', () => {
  it('compara telefones só pelos dígitos, com ou sem +55', () => {
    expect(normalizePhone('(11) 98888-1234')).toBe('11988881234');
    expect(normalizePhone('+55 11 98888-1234')).toBe('11988881234');
    expect(normalizePhone('123')).toBeNull();
    expect(normalizeEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
  });
});

describe('decisão do cliente', () => {
  it('pedido de revisão exige mensagem', () => {
    expect(customerDecisionSchema.safeParse({ decision: 'request_revision', versionNumber: 1 }).success).toBe(false);
    expect(
      customerDecisionSchema.safeParse({ decision: 'request_revision', versionNumber: 1, message: 'Sem a ressolda' }).success,
    ).toBe(true);
  });
});

describe('dinheiro em centavos', () => {
  it('converte formatos brasileiros e com ponto decimal', () => {
    expect(toCents('42,50')).toBe(4250);
    expect(toCents('1.234,56')).toBe(123456);
    expect(toCents('42.50')).toBe(4250);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('-1')).toBeNull();
    expect(toCents('')).toBeNull();
  });

  it('soma linhas sem erro de arredondamento', () => {
    expect(totalCents([{ quantity: 1, unitPriceCents: 4200 }, { quantity: 1, unitPriceCents: 8500 }])).toBe(12700);
    expect(formatCents(12700).replace(/\s/g, ' ')).toBe('R$ 127,00');
  });
});
