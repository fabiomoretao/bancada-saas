import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { STATUS_LABELS, WORK_ORDER_STATUSES } from '@bancada/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useWorkOrders } from '../api/hooks';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge } from '../components/StatusBadge';
import { instrumentTitle, relativeDay } from '../lib/format';
import { WorkOrderDetail } from './WorkOrderDetail';
import styles from './QueuePage.module.css';

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Fila técnica: lista pesquisável à esquerda, detalhe da OS selecionada ao lado. */
export function QueuePage() {
  const { id: selectedId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const query = useDebounced(search.trim());

  const list = useWorkOrders({ query, status });
  const items = list.data?.items ?? [];

  // Sem OS na URL: seleciona a primeira da fila (só no desktop faz diferença visual).
  useEffect(() => {
    const first = items[0];
    if (!selectedId && first) navigate(`/ordens/${first.id}`, { replace: true });
  }, [selectedId, items, navigate]);

  const filtered = Boolean(query || status);

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <div className="eyebrow">Visão da oficina</div>
          <h1 className={styles.title}>Ordens de serviço</h1>
          <p className={styles.subtitle}>Veja o que está em andamento e qual é o próximo passo.</p>
        </div>
        <Link to="/ordens/nova" className="btn btn-primary">
          <PlusIcon size={18} aria-hidden="true" />
          Nova ordem
        </Link>
      </div>

      <div className={`surface ${styles.workspace}`}>
        <section className={styles.queue} aria-labelledby="fila-titulo">
          <div className={styles.queueHead}>
            <h2 id="fila-titulo" className={styles.queueTitle}>
              Fila técnica
            </h2>
            <span className={styles.count} aria-live="polite">
              {list.data ? `${list.data.total} ${list.data.total === 1 ? 'ordem' : 'ordens'}` : ''}
            </span>
          </div>

          <div className={styles.controls}>
            <label className={styles.search}>
              <MagnifyingGlassIcon size={18} aria-hidden="true" />
              <span className="visually-hidden">Buscar ordens</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Código, cliente ou instrumento"
              />
            </label>
            <label className={styles.filter}>
              <span className="visually-hidden">Filtrar por status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                <option value="">Todos os status</option>
                {WORK_ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.columns} aria-hidden="true">
            <span>Ordem / instrumento</span>
            <span>Status</span>
            <span>Entrada</span>
          </div>

          {list.isPending ? (
            <StateMessage kind="loading" title="Carregando ordens…" />
          ) : list.isError ? (
            <StateMessage
              kind="error"
              title="Não foi possível carregar a fila"
              action={
                <button className="btn" onClick={() => list.refetch()}>
                  Tentar de novo
                </button>
              }
            >
              {list.error.message}
            </StateMessage>
          ) : items.length === 0 ? (
            filtered ? (
              <StateMessage title="Nenhuma ordem encontrada">Ajuste a busca ou o filtro de status.</StateMessage>
            ) : (
              <StateMessage title="Nenhuma ordem ainda" action={<Link to="/ordens/nova" className="btn">Abrir a primeira ordem</Link>}>
                Quando um instrumento chegar, registre a entrada aqui.
              </StateMessage>
            )
          ) : (
            <ul className={styles.list}>
              {items.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/ordens/${order.id}`}
                    className={styles.row}
                    aria-current={order.id === selectedId ? 'true' : undefined}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.code}>{order.code}</span>
                      <span className={styles.instrument}>{instrumentTitle(order.instrument)}</span>
                      <span className={styles.customer}>{order.customerName}</span>
                    </span>
                    <span className={styles.rowStatus}>
                      <StatusBadge status={order.status} />
                      {order.needsWorkshopAttention && <span className={styles.attention}>Ação da oficina</span>}
                    </span>
                    <span className={styles.date}>{relativeDay(order.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.detail} aria-label="Detalhes da ordem selecionada">
          {selectedId ? (
            <WorkOrderDetail id={selectedId} />
          ) : (
            !list.isPending && <StateMessage title="Selecione uma ordem">Os detalhes aparecem aqui.</StateMessage>
          )}
        </section>
      </div>
    </>
  );
}
