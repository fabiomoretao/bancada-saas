import { ClipboardTextIcon, GuitarIcon, SignOutIcon, UsersIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { ROLE_LABELS } from '@bancada/shared';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLogout, useSession } from '../api/hooks';
import logo from '../assets/logo-bancada.svg';
import { AppSplash } from '../components/Loading';
import { StateMessage } from '../components/StateMessage';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/ordens', label: 'Ordens de serviço', icon: ClipboardTextIcon },
  { to: '/clientes', label: 'Clientes', icon: UsersIcon },
  { to: '/instrumentos', label: 'Instrumentos', icon: GuitarIcon },
  { to: '/equipe', label: 'Equipe', icon: UsersThreeIcon },
];

function sectionTitle(pathname: string): string {
  if (pathname === '/ordens/nova') return 'Nova ordem';
  if (pathname.endsWith('/orcamento')) return 'Diagnóstico e orçamento';
  if (pathname === '/clientes/novo') return 'Novo cliente';
  return NAV.find((item) => pathname.startsWith(item.to))?.label ?? 'Bancada';
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Shell da oficina: exige login; navegação lateral, barra superior e conteúdo da rota. */
export function AppShell() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const logout = useLogout();

  if (session.isPending) return <AppSplash />;
  if (session.isError) {
    return (
      <StateMessage kind="error" title="Não foi possível falar com o servidor">
        {session.error.message}
      </StateMessage>
    );
  }
  if (!session.data) return <Navigate to={`/entrar?voltar=${encodeURIComponent(pathname + search)}`} replace />;
  const { user, workshop } = session.data;

  async function signOut() {
    await logout.mutateAsync().catch(() => undefined);
    navigate('/entrar', { replace: true });
  }

  return (
    <div className={styles.app}>
      <a href="#conteudo" className={styles.skip}>
        Pular para o conteúdo
      </a>

      <aside className={styles.sidebar}>
        <NavLink to="/ordens" className={styles.brand} aria-label="Bancada, início">
          <img className={styles.logo} src={logo} alt="" />
          <span className={styles.brandText}>
            <span className={styles.brandName}>Bancada</span>
            <span className={styles.brandCaption}>Oficina de instrumentos</span>
          </span>
        </NavLink>

        <nav aria-label="Principal" className={styles.nav}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}>
              <Icon size={20} aria-hidden="true" />
              <span className={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.workshop}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className={styles.workshopText}>
            <strong>{user.name}</strong>
            <small>
              {ROLE_LABELS[user.role]} · {workshop.name}
            </small>
          </span>
        </div>
        <button type="button" className={styles.signOut} onClick={signOut} disabled={logout.isPending}>
          <SignOutIcon size={18} aria-hidden="true" />
          <span className={styles.navLabel}>Sair</span>
        </button>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.crumb}>
            Bancada <span aria-hidden="true">/</span> <strong>{sectionTitle(pathname)}</strong>
          </div>
          <span className={styles.demoTag}>{workshop.name}</span>
        </header>
        <main id="conteudo" className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
