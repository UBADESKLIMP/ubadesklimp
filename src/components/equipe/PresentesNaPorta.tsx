import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EquipeColaborador, PresenteNaPorta } from '@/hooks/useEquipe';

interface Props {
  colaboradores: EquipeColaborador[];
  presentes: PresenteNaPorta[];
  horaAbertura: string;
  salvando: boolean;
  onSalvar: (lista: PresenteNaPorta[]) => Promise<boolean>;
}

const PresentesNaPorta = ({ colaboradores, presentes, horaAbertura, salvando, onSalvar }: Props) => {
  const [marcados, setMarcados] = useState<Map<string, string>>(new Map());
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    setMarcados(
      new Map(presentes.map((p) => [p.colaborador_id, p.hora_chegada_porta?.slice(0, 5) ?? '']))
    );
  }, [presentes]);

  const alternar = (id: string) => {
    setMarcados((prev) => {
      const proximo = new Map(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.set(id, '');
      return proximo;
    });
  };

  const definirHora = (id: string, hora: string) => {
    setMarcados((prev) => new Map(prev).set(id, hora));
  };

  const salvar = async () => {
    const lista: PresenteNaPorta[] = [...marcados.entries()].map(([colaborador_id, hora]) => ({
      colaborador_id,
      hora_chegada_porta: /^\d{2}:\d{2}$/.test(hora) ? hora : null,
    }));
    const ok = await onSalvar(lista);
    if (ok) setEditando(false);
  };

  const nomesMarcados = colaboradores
    .filter((c) => marcados.has(c.user_id))
    .map((c) => c.display_name);

  if (!editando) {
    return (
      <div className="border-t border-blue-500/10 pt-3 mt-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <DoorOpen className="h-4 w-4 text-blue-300/60 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-white">
                {presentes.length === 0
                  ? 'Ninguém marcado como presente na porta'
                  : `${presentes.length} ${presentes.length === 1 ? 'pessoa estava' : 'pessoas estavam'} na porta`}
              </p>
              {presentes.length > 0 ? (
                <p className="text-xs text-blue-300/60 mt-0.5">{nomesMarcados.join(', ')}</p>
              ) : (
                <p className="text-xs text-blue-300/50 mt-0.5">
                  Marque agora, enquanto você lembra — vem preenchido no lançamento do atraso.
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditando(true)}
            className="h-10 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
          >
            {presentes.length === 0 ? 'Marcar quem estava' : 'Editar'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-blue-500/10 pt-3 mt-3 space-y-3">
      <div>
        <p className="text-sm text-white">Quem já estava na porta às {horaAbertura.slice(0, 5)}?</p>
        <p className="text-xs text-blue-300/50 mt-0.5">
          A hora de chegada é opcional. Sem ela, a referência de quem estava na porta passa a ser a
          hora da abertura; com ela, a chegada é medida contra o horário da escala.
        </p>
      </div>

      {colaboradores.length === 0 ? (
        <p className="text-sm text-blue-300/60">Nenhum colaborador nesta empresa.</p>
      ) : (
        <div className="space-y-1.5">
          {colaboradores.map((c) => {
            const marcado = marcados.has(c.user_id);
            return (
              <div
                key={c.user_id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                  marcado
                    ? 'border-[#0F6B5C]/50 bg-[#0F6B5C]/10'
                    : 'border-blue-500/10 bg-[#0c0c14]'
                )}
              >
                <button
                  type="button"
                  onClick={() => alternar(c.user_id)}
                  className="flex items-center gap-3 flex-1 min-w-[8rem] text-left"
                >
                  <span
                    className={cn(
                      'h-5 w-5 rounded border-2 shrink-0 flex items-center justify-center text-[11px] font-bold',
                      marcado
                        ? 'border-[#0F6B5C] bg-[#0F6B5C] text-white'
                        : 'border-blue-500/30'
                    )}
                  >
                    {marcado ? '✓' : ''}
                  </span>
                  <span className={cn('text-sm', marcado ? 'text-white' : 'text-blue-300/70')}>
                    {c.display_name}
                  </span>
                </button>

                {marcado && (
                  <Input
                    type="time"
                    inputMode="numeric"
                    value={marcados.get(c.user_id) ?? ''}
                    onChange={(e) => definirHora(c.user_id, e.target.value)}
                    placeholder="chegou às"
                    className="bg-[#12121a] border-blue-500/20 h-10 font-mono w-28 text-white placeholder:text-blue-300/40 [color-scheme:dark]"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={salvar} disabled={salvando} className="h-10 bg-blue-600 hover:bg-blue-500">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
          Salvar lista
        </Button>
        <Button
          variant="ghost"
          onClick={() => setEditando(false)}
          className="h-10 text-blue-300/70 hover:text-white hover:bg-blue-500/10"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
};

export default PresentesNaPorta;
