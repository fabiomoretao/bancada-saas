import { CopyIcon } from '@phosphor-icons/react';
import { absoluteUrl } from '../lib/format';
import { useToast } from './Toast';

/** Copia o link privado. Só copia: o envio ao cliente é manual. */
export function CopyLinkButton({
  path,
  label = 'Copiar link do cliente',
  className = 'btn',
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const toast = useToast();

  async function copy() {
    const url = absoluteUrl(path);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback para navegadores sem permissão de clipboard
      const area = document.createElement('textarea');
      area.value = url;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast('Link copiado');
  }

  return (
    <button type="button" className={className} onClick={copy}>
      <CopyIcon size={18} aria-hidden="true" />
      {label}
    </button>
  );
}
