import { MagnifyingGlassIcon, NotePencilIcon, PlusIcon, UserPlusIcon } from '@phosphor-icons/react';
import type { CustomerDetailDTO } from '@bancada/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCustomer, useCustomers } from '../api/hooks';
import { CustomerForm } from '../components/CustomerForm';
import { DetailSkeleton, ListSkeleton } from '../components/Loading';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { instrumentTitle, relativeDay } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import styles from './CustomersPage.module.css';

/**
 * Clientes: pesquisar ou cadastrar uma pessoa e consultar seus instrumentos
 * e ordens anteriores. Os dados ficam restritos à oficina.
 */
export function CustomersPage({ creating = false }: { creating?: boolean }) {
  const { id: selectedId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const list = useCustomers(query);
  const items = list.data?.items ?? [];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <div className="eyebrow">Cadastro da oficina</div>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>Pesquise pelo nome, telefone ou e-mail e veja os instrumentos e as ordens de cada pessoa.</p>
        </div>
        <Link to="/clientes/novo" className="btn btn-primary">
          <UserPlusIcon size={18} aria-hidden="true" /> Novo cliente
        </Link>
      </div>

      <div className={`surface ${styles.workspace}`}>
        <section className={styles.listPane} aria-labelledby="clientes-lista">
          <div className={styles.listHead}>
            <h2 id="clientes-lista" className={styles.listTitle}>
              Cadastros
            </h2>
            <span className={styles.count} aria-live="polite">
              {list.data ? `${list.data.total} ${list.data.total === 1 ? 'cliente' : 'clientes'}` : ''}
            </span>
          </div>
          <label className={styles.search}>
            <MagnifyingGlassIcon size={18} aria-hidden="true" />
            <span className="visually-hidden">Buscar clientes</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, telefone ou e-mail" />
          </label>

          {list.isPending ? (
            <ListSkeleton label="Carregando clientes…" variant="people" />
          ) : list.isError ? (
            <StateMessage kind="error" title="Não foi possível carregar os clientes">
              {list.error.message}
            </StateMessage>
          ) : items.length === 0 ? (
            <StateMessage
              title={query ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'}
              action={
                <Link to="/clientes/novo" className="btn">
                  Cadastrar cliente
                </Link>
              }
            >
              {query ? 'Confira a grafia ou cadastre a pessoa.' : 'Os clientes aparecem aqui ao abrir uma OS ou cadastrar.'}
            </StateMessage>
          ) : (
            <ul className={styles.list}>
              {items.map((c) => (
                <li key={c.id}>
                  <Link to={`/clientes/${c.id}`} className={styles.row} aria-current={c.id === selectedId ? 'true' : undefined}>
                    <span className={styles.rowMain}>
                      <strong>{c.name}</strong>
                      <small>{[c.phone, c.email].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className={styles.rowMeta}>
                      {c.orderCount} {c.orderCount === 1 ? 'ordem' : 'ordens'}
                      {c.lastOrderAt && <small>Última: {relativeDay(c.lastOrderAt)}</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.detailPane} aria-label="Cliente selecionado">
          {creating ? (
            <>
              <h2 className={styles.detailTitle}>Novo cliente</h2>
              <p className={styles.muted}>Nome e pelo menos um contato. Os dados ficam visíveis só para a oficina.</p>
              <CustomerForm
                submitLabel="Cadastrar cliente"
                onSaved={(id) => {
                  toast('Cliente cadastrado');
                  navigate(`/clientes/${id}`);
                }}
                onCancel={() => navigate('/clientes')}
                onOpenExisting={(m) => navigate(`/clientes/${m.id}`)}
              />
            </>
          ) : selectedId ? (
            <CustomerDetail id={selectedId} />
          ) : (
            <StateMessage title="Selecione um cliente">O cadastro, os instrumentos e o histórico de ordens aparecem aqui.</StateMessage>
          )}
        </section>
      </div>
    </>
  );
}

function CustomerDetail({ id }: { id: string }) {
  const { data, isPending, isError, error } = useCustomer(id);
  if (isPending) return <DetailSkeleton label="Carregando cliente…" />;
  if (isError) return <StateMessage kind="error" title="Não foi possível abrir este cliente">{error.message}</StateMessage>;
  return <CustomerDetailContent key={data.id} customer={data} />;
}

function CustomerDetailContent({ customer }: { customer: CustomerDetailDTO }) {
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  return (
    <article>
      <div className={styles.detailHead}>
        <div>
          <h2 className={styles.detailTitle}>{customer.name}</h2>
          <p className={styles.muted}>
            {customer.orders.length} {customer.orders.length === 1 ? 'ordem' : 'ordens'} · {customer.instruments.length}{' '}
            {customer.instruments.length === 1 ? 'instrumento' : 'instrumentos'}
          </p>
        </div>
        <Link to={`/ordens/nova?cliente=${customer.id}`} className="btn btn-primary">
          <PlusIcon size={18} aria-hidden="true" /> Nova OS
        </Link>
      </div>

      <section className={styles.block} aria-labelledby="contato-titulo">
        <div className={styles.blockHead}>
          <h3 id="contato-titulo" className={styles.blockTitle}>
            Contato
          </h3>
          {!editing && (
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
              <NotePencilIcon size={16} aria-hidden="true" /> Editar
            </button>
          )}
        </div>
        {editing ? (
          <CustomerForm
            customerId={customer.id}
            initial={customer}
            submitLabel="Salvar alterações"
            onSaved={() => {
              setEditing(false);
              toast('Cadastro atualizado');
            }}
            onCancel={() => setEditing(false)}
            onOpenExisting={(m) => navigate(`/clientes/${m.id}`)}
          />
        ) : (
          <dl className={styles.facts}>
            <div>
              <dt>Telefone</dt>
              <dd>{customer.phone ?? '—'}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{customer.email ?? '—'}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className={styles.block} aria-labelledby="instrumentos-titulo">
        <h3 id="instrumentos-titulo" className={styles.blockTitle}>
          Instrumentos
        </h3>
        {customer.instruments.length === 0 ? (
          <p className={styles.muted}>Nenhum instrumento ainda. Ele é cadastrado ao abrir a primeira OS.</p>
        ) : (
          <div className={styles.tableBox}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Instrumento</th>
                  <th scope="col">Nº de série</th>
                  <th scope="col">Ordens</th>
                </tr>
              </thead>
              <tbody>
                {customer.instruments.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.type}</strong>
                      <small>{[i.brand, i.model].filter(Boolean).join(' · ') || 'Sem marca/modelo'}</small>
                    </td>
                    <td>{i.serialNumber ?? '—'}</td>
                    <td>{i.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.block} aria-labelledby="ordens-titulo">
        <h3 id="ordens-titulo" className={styles.blockTitle}>
          Ordens anteriores
        </h3>
        {customer.orders.length === 0 ? (
          <p className={styles.muted}>Nenhuma ordem ainda.</p>
        ) : (
          <ul className={styles.orders}>
            {customer.orders.map((o) => (
              <li key={o.id}>
                <Link to={`/ordens/${o.id}`} className={styles.orderRow}>
                  <span className={styles.rowMain}>
                    <small>
                      {o.code} · {relativeDay(o.createdAt)}
                    </small>
                    <strong>{instrumentTitle(o.instrument)}</strong>
                  </span>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
