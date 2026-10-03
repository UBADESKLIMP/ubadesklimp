import { useState } from 'react';
import { Monitor, Wifi, Clock, LayoutDashboard, Loader2, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FichaDaEstacao, Atalho } from '@/hooks/usePontoQuiosque';

interface Props {
  ficha: FichaDaEstacao;
  salvarAtalhos: (atalhos: Atalho[]) => Promise<{ ok: boolean; mensagem?: string }>;
  onModoFacil: () => void;
  onAbrirPainel: () => void;
}

const OPCIONAIS: { chave: Atalho; titulo: string; descricao: string }[] = [
  {
    chave: 'abrir_loja',
    titulo: 'Abrir loja',
    descricao: 'Registra a abertura e bate a entrada de quem estava na porta.',
  },
  {
    chave: 'reportar_faltante',
    titulo: 'Reportar faltante',
    descricao: 'Manda um produto direto pra lista de compras.',
  },
];

const quando = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/**
 * O que este computador é e o que ele faz. Fica atrás do PIN de manutenção —
 * é o único lugar do quiosque que não é pra equipe usar no dia a dia.
 */
const Bastidor = ({ ficha, salvarAtalhos, onModoFacil, onAbrirPainel }: Props) => {
  const [atalhos, setAtalhos] = useState<Atalho[]>(ficha.atalhos ?? ['bater_ponto']);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const alternar = async (chave: Atalho) => {
    const proximo = atalhos.includes(chave)
      ? atalhos.filter((a) => a !== chave)
      : [...atalhos, chave];
    setAtalhos(proximo);
    setAviso(null);
    setSalvando(true);
    const r = await salvarAtalhos(proximo);
    setSalvando(false);
    if (!r.ok) {
      setAtalhos(atalhos);
      setAviso(r.mensagem ?? 'Não foi possível salvar.');
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-5 pb-6">
      <div className="max-w-lg mx-auto flex flex-col gap-5 pt-2">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Monitor className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-heading">{ficha.nome}</h1>
          <p className="text-sm text-[#55605F] mt-1">{ficha.local}</p>
        </div>

        <div className="rounded-2xl border border-[#DCDFD8] bg-white divide-y divide-[#ECEEE9]">
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <Wifi className="h-4 w-4 text-[#8A9290] shrink-0" />
            <span className="text-[#55605F] flex-1">IP visto pela loja</span>
            <span className="font-mono text-[#141B1E]">{ficha.ultimo_ip ?? '—'}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <Clock className="h-4 w-4 text-[#8A9290] shrink-0" />
            <span className="text-[#55605F] flex-1">Último sinal</span>
            <span className="font-mono text-[#141B1E]">{quando(ficha.ultimo_heartbeat)}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 text-sm">
            <Check className="h-4 w-4 text-[#8A9290] shrink-0" />
            <span className="text-[#55605F] flex-1">Batidas hoje nesta loja</span>
            <span className="font-mono text-[#141B1E]">{ficha.batidas_hoje ?? 0}</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">O que aparece no modo fácil</p>
          <p className="text-xs text-[#8A9290] mb-3">
            Bater ponto é sempre o centro da tela. O resto você escolhe.
          </p>

          <div className="flex flex-col gap-2">
            <div className="rounded-2xl border border-[#DCDFD8] bg-[#ECEEE9]/60 px-4 py-3 flex items-start gap-3">
              <Lock className="h-4 w-4 text-[#8A9290] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">Bater ponto</p>
                <p className="text-xs text-[#8A9290] mt-0.5">
                  É o motivo de esta estação existir — não sai da tela.
                </p>
              </div>
            </div>

            {OPCIONAIS.map((o) => {
              const ligado = atalhos.includes(o.chave);
              return (
                <button
                  key={o.chave}
                  type="button"
                  onClick={() => alternar(o.chave)}
                  disabled={salvando}
                  className={cn(
                    'rounded-2xl border px-4 py-3 flex items-start gap-3 text-left transition',
                    ligado
                      ? 'border-primary bg-primary/5'
                      : 'border-[#DCDFD8] bg-white hover:border-primary/40'
                  )}
                >
                  <span
                    className={cn(
                      'h-5 w-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold',
                      ligado ? 'border-primary bg-primary text-white' : 'border-[#DCDFD8]'
                    )}
                  >
                    {ligado ? '✓' : ''}
                  </span>
                  <div>
                    <p className="text-sm">{o.titulo}</p>
                    <p className="text-xs text-[#8A9290] mt-0.5">{o.descricao}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {salvando && (
            <p className="text-xs text-[#8A9290] mt-2 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Salvando
            </p>
          )}
          {aviso && <p className="text-xs text-[#C0392B] mt-2">{aviso}</p>}
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={onModoFacil}
            className="h-14 rounded-2xl bg-primary text-primary-foreground text-base font-medium active:scale-[0.99] transition"
          >
            Voltar ao modo fácil
          </button>
          <button
            type="button"
            onClick={onAbrirPainel}
            className="h-12 rounded-2xl border border-[#DCDFD8] bg-white text-sm text-[#55605F] hover:text-[#141B1E] flex items-center justify-center gap-2 transition"
          >
            <LayoutDashboard className="h-4 w-4" />
            Abrir o painel neste computador
          </button>
        </div>
      </div>
    </main>
  );
};

export default Bastidor;
