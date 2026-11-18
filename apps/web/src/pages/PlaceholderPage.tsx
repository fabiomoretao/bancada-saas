import { StateMessage } from '../components/StateMessage';

/** Clientes e Instrumentos: telas de consulta previstas para uma próxima etapa. */
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h1 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-6)' }}>{title}</h1>
      <div className="surface">
        <StateMessage title="Em construção">{description}</StateMessage>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="surface" style={{ maxWidth: 560, margin: '10vh auto' }}>
      <StateMessage title="Página não encontrada">Confira o endereço ou volte para a fila de ordens.</StateMessage>
    </div>
  );
}
