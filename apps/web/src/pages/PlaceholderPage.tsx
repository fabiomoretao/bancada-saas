import { Link } from 'react-router-dom';
import { StateMessage } from '../components/StateMessage';

export function NotFoundPage() {
  return (
    <div className="surface" style={{ maxWidth: 560, margin: '10vh auto' }}>
      <StateMessage
        title="Página não encontrada"
        action={
          <Link to="/ordens" className="btn">
            Ir para a fila
          </Link>
        }
      >
        Confira o endereço ou volte para a fila de ordens.
      </StateMessage>
    </div>
  );
}
