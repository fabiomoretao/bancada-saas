import { ClipboardTextIcon, GuitarIcon, UsersIcon } from '@phosphor-icons/react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import logo from '../assets/logo-bancada.svg';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/ordens', label: 'Ordens de serviço', icon: ClipboardTextIcon },
  { to: '/clientes', label: 'Clientes', icon: UsersIcon },
  { to: '/instrumentos', label: 'Instrumentos', icon: GuitarIcon },
];

function sectionTitle(pathname: string): string {
  if (pathname === '/ordens/nova') return 'Nova ordem';
  if (pathname.endsWith('/orcamento')) return 'Diagnóstico e orçamento';
  return NAV.find((item) => pathname.startsWith(item.to))?.label ?? 'Bancada';
}

/** Shell da oficina: navegação lateral, barra superior e conteúdo da rota. */
export function AppShell() {
  const { pathname } = useLocation();

  return (
    <div className={styles.app}>
      <a href="#conteudo" className={styles.skip}>
        Pular para o conteúdo
      </a>

      <aside className={styles.sidebar}>
        <NavLink to="/ordens" className={styles.brand} aria-label="Bancada — início">
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
            BC
          </span>
          <span className={styles.workshopText}>
            <strong>Bancada do Centro</strong>
            <small>Oficina de demonstração</small>
          </span>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.crumb}>
            Bancada <span aria-hidden="true">/</span> <strong>{sectionTitle(pathname)}</strong>
          </div>
          <span className={styles.demoTag} title="Sem login: todas as ações usam a oficina de demonstração.">
            Modo demonstração
          </span>
        </header>
        <main id="conteudo" className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
