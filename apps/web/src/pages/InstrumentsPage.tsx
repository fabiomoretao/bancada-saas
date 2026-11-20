import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useInstrument, useInstruments } from '../api/hooks';
import { DetailSkeleton, ListSkeleton } from '../components/Loading';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, instrumentTitle, relativeDay } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import styles from './CustomersPage.module.css';

/** Instrumentos: consulta por tipo, marca, modelo, série ou dono, com o histórico de reparos. */
export function InstrumentsPage() {
  const { id: selectedId } = useParams();
  const [search, setSearch] = useState('');
  const query = useDebounced(search.trim());
  const list = useInstruments(query);
  const items = list.data?.items ?? [];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <div className="eyebrow">Cadastro da oficina</div>
          <h1 className={styles.title}>Instrumentos</h1>
          <p className={styles.subtitle}>Cada instrumento fica ligado ao dono e guarda o histórico de ordens de serviço.</p>
        </div>
      </div>

      <div className={`surface ${styles.workspace}`}>
        <section className={styles.listPane} aria-labelledby="instrumentos-lista">
          <div className={styles.listHead}>
            <h2 id="instrumentos-lista" className={styles.listTitle}>
              Instrumentos
            </h2>
            <span className={styles.count} aria-live="polite">
              {list.data ? `${list.data.total} ${list.data.total === 1 ? 'instrumento' : 'instrumentos'}` : ''}
            </span>
          </div>
          <label className={styles.search}>
            <MagnifyingGlassIcon size={18} aria-hidden="true" />
            <span className="visually-hidden">Buscar instrumentos</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tipo, marca, modelo, série ou dono"
            />
          </label>

          {list.isPending ? (
            <ListSkeleton label="Carregando instrumentos…" variant="people" />
          ) : list.isError ? (
            <StateMessage kind="error" title="Não foi possível carregar os instrumentos">
              {list.error.message}
            </StateMessage>
          ) : items.length === 0 ? (
            <StateMessage title={query ? 'Nenhum instrumento encontrado' : 'Nenhum instrumento ainda'}>
              {query ? 'Confira a grafia ou busque pelo dono.' : 'Os instrumentos são cadastrados ao abrir uma OS.'}
            </StateMessage>
          ) : (
            <ul className={styles.list}>
              {items.map((i) => (
                <li key={i.id}>
                  <Link to={`/instrumentos/${i.id}`} className={styles.row} aria-current={i.id === selectedId ? 'true' : undefined}>
                    <span className={styles.rowMain}>
                      <strong>{instrumentTitle(i)}</strong>
                      <small>
                        {[i.brand, i.customer.name].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <span className={styles.rowMeta}>
                      {i.lastStatus ? <StatusBadge status={i.lastStatus} /> : 'Sem ordens'}
                      {i.lastOrderAt && <small>{relativeDay(i.lastOrderAt)}</small>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.detailPane} aria-label="Instrumento selecionado">
          {selectedId ? (
            <InstrumentDetail id={selectedId} />
          ) : (
            <StateMessage title="Selecione um instrumento">O dono e o histórico de ordens aparecem aqui.</StateMessage>
          )}
        </section>
      </div>
    </>
  );
}

function InstrumentDetail({ id }: { id: string }) {
  const { data, isPending, isError, error } = useInstrument(id);
  if (isPending) return <DetailSkeleton label="Carregando instrumento…" />;
  if (isError) return <StateMessage kind="error" title="Não foi possível abrir este instrumento">{error.message}</StateMessage>;

  return (
    <article>
      <div className={styles.detailHead}>
        <div>
          <h2 className={styles.detailTitle}>{instrumentTitle(data)}</h2>
          <p className={styles.muted}>
            {data.orders.length} {data.orders.length === 1 ? 'ordem' : 'ordens'} · cadastrado em {formatDate(data.createdAt)}
          </p>
        </div>
        <Link to={`/ordens/nova?cliente=${data.customer.id}&instrumento=${data.id}`} className="btn btn-primary">
          <PlusIcon size={18} aria-hidden="true" /> Nova OS
        </Link>
      </div>

      <section className={styles.block} aria-labelledby="dados-titulo">
        <h3 id="dados-titulo" className={styles.blockTitle}>
          Dados
        </h3>
        <dl className={styles.facts}>
          <div>
            <dt>Marca</dt>
            <dd>{data.brand ?? '—'}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{data.model ?? '—'}</dd>
          </div>
          <div>
            <dt>Nº de série</dt>
            <dd>{data.serialNumber ?? '—'}</dd>
          </div>
          <div>
            <dt>Dono</dt>
            <dd>
              <Link to={`/clientes/${data.customer.id}`}>{data.customer.name}</Link>
              <br />
              <small>{[data.customer.phone, data.customer.email].filter(Boolean).join(' · ')}</small>
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.block} aria-labelledby="historico-titulo">
        <h3 id="historico-titulo" className={styles.blockTitle}>
          Histórico de reparos
        </h3>
        {data.orders.length === 0 ? (
          <p className={styles.muted}>Nenhuma ordem para este instrumento.</p>
        ) : (
          <ul className={styles.orders}>
            {data.orders.map((o) => (
              <li key={o.id}>
                <Link to={`/ordens/${o.id}`} className={styles.orderRow}>
                  <span className={styles.rowMain}>
                    <strong>{o.code}</strong>
                    <small>Entrada {relativeDay(o.createdAt)}</small>
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
