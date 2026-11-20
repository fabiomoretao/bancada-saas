import type { CSSProperties } from 'react';
import logo from '../assets/logo-bancada.svg';
import styles from './Loading.module.css';

/**
 * Telas de carregamento. Cada uma imita o formato da tela que vai aparecer
 * (esqueleto), para a página não "pular" quando os dados chegam.
 *
 * Acessibilidade: o bloco é role="status" com o texto em um rótulo oculto;
 * as formas cinzas ficam escondidas dos leitores de tela. Com
 * "reduzir movimento" ativado, o brilho animado é desligado.
 * Em respostas rápidas (< 150 ms) nada aparece, para não piscar.
 */

function Bone({ w = '100%', h = 12, r, style }: { w?: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className={styles.bone} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function Busy({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={styles.busy} role="status" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      <div className={className} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

/** Abertura do sistema, enquanto confere se a pessoa está logada. */
export function AppSplash({ label = 'Abrindo o Bancada…' }: { label?: string }) {
  return (
    <div className={styles.splash} role="status" aria-busy="true">
      <img src={logo} alt="" className={styles.splashLogo} />
      <span className={styles.splashName}>Bancada</span>
      <span className={styles.splashBar} aria-hidden="true">
        <span />
      </span>
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

/** Linhas de lista (fila de ordens, clientes, instrumentos). */
export function ListSkeleton({
  label,
  rows = 6,
  variant = 'orders',
}: {
  label: string;
  rows?: number;
  variant?: 'orders' | 'people';
}) {
  return (
    <Busy label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={variant === 'orders' ? styles.orderRow : styles.personRow}>
          <span className={styles.rowMain}>
            {variant === 'orders' && <Bone w={52} h={10} />}
            <Bone w={`${62 - ((i * 13) % 26)}%`} h={14} />
            <Bone w={`${38 - ((i * 7) % 14)}%`} h={11} />
          </span>
          {variant === 'orders' ? (
            <>
              <Bone w={`${70 + ((i * 11) % 30)}%`} h={22} r={999} />
              <Bone w={44} h={10} />
            </>
          ) : (
            <Bone w={56} h={10} />
          )}
        </div>
      ))}
    </Busy>
  );
}

/** Detalhe de uma ordem, cliente ou instrumento. */
export function DetailSkeleton({ label }: { label: string }) {
  return (
    <Busy label={label} className={styles.detail}>
      <div className={styles.detailHead}>
        <span className={styles.rowMain}>
          <Bone w={70} h={10} />
          <Bone w="58%" h={24} />
          <Bone w="36%" h={12} />
        </span>
        <Bone w={120} h={26} r={999} />
      </div>
      <div className={styles.grid2}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={styles.rowMain}>
            <Bone w={60} h={9} />
            <Bone w={`${80 - i * 12}%`} h={13} />
          </span>
        ))}
      </div>
      <div className={styles.panel}>
        <Bone w={110} h={12} />
        <Bone w="92%" h={11} />
        <Bone w="74%" h={11} />
        <span className={styles.inline}>
          <Bone w={150} h={40} r={12} />
          <Bone w={120} h={40} r={12} />
        </span>
      </div>
      <div className={styles.timeline}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={styles.timelineStep}>
            <Bone w={12} h={12} r={999} />
            <Bone w="70%" h={9} />
          </span>
        ))}
      </div>
    </Busy>
  );
}

/** Formulário de diagnóstico e orçamento. */
export function EstimateSkeleton() {
  return (
    <Busy label="Carregando orçamento…" className={styles.estimate}>
      <span className={styles.rowMain}>
        <Bone w={90} h={10} />
        <Bone w={300} h={28} style={{ maxWidth: '80%' }} />
        <Bone w={220} h={12} style={{ maxWidth: '60%' }} />
      </span>
      <div className={styles.estimateGrid}>
        <div className={styles.card}>
          <Bone w={120} h={16} />
          <Bone w="100%" h={88} r={12} />
          <Bone w={80} h={16} style={{ marginTop: 12 }} />
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.itemRow}>
              <Bone w="100%" h={40} r={10} />
              <Bone w="100%" h={40} r={10} />
              <Bone w="100%" h={40} r={10} />
            </span>
          ))}
        </div>
        <div className={styles.card}>
          <Bone w={110} h={16} />
          <Bone w="100%" h={40} r={10} />
          <Bone w="70%" h={12} />
          <Bone w={130} h={34} style={{ marginTop: 16 }} />
          <Bone w="100%" h={44} r={12} style={{ marginTop: 8 }} />
        </div>
      </div>
    </Busy>
  );
}

/** Tabela da equipe. */
export function TableSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <Busy label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.tableRow}>
          <span className={styles.rowMain}>
            <Bone w={`${50 - i * 6}%`} h={13} />
            <Bone w={`${40 - i * 4}%`} h={10} />
          </span>
          <Bone w={80} h={12} />
          <Bone w={50} h={12} />
          <Bone w={90} h={12} />
        </div>
      ))}
    </Busy>
  );
}

/** Página do cliente (link privado), pensada para o celular. */
export function PublicOrderSkeleton() {
  return (
    <Busy label="Carregando sua ordem…" className={styles.public}>
      <span className={styles.rowMain}>
        <Bone w={140} h={10} />
        <Bone w="85%" h={26} />
        <Bone w="60%" h={26} />
      </span>
      <span className={styles.rowMain}>
        <Bone w={90} h={14} />
        <Bone w="70%" h={11} />
        <Bone w={170} h={12} />
      </span>
      <div className={styles.publicSteps}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={styles.publicStep}>
            <Bone w={14} h={14} r={999} />
            <span className={styles.rowMain} style={{ flex: 1 }}>
              <Bone w="45%" h={12} />
              <Bone w="80%" h={10} />
            </span>
          </span>
        ))}
      </div>
      <div className={styles.card}>
        <Bone w={110} h={10} />
        <Bone w={140} h={20} />
        <Bone w="100%" h={120} r={12} />
        <Bone w="100%" h={46} r={12} />
        <Bone w="100%" h={46} r={12} />
      </div>
    </Busy>
  );
}
