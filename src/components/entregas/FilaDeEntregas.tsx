import { useMemo, useState } from 'react';
import { AlertTriangle, MapPin, Phone, PackageX, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminLoadingState from '@/components/admin/AdminLoadingState';
import { SeloEntrega, SeloTentativa } from './SeloEntrega';
import {
  MOTIVO_LABEL,
  diaCurto,
  emReais,
  type EntregaDaFila,
  type ResultadoRpc,
} from '@/hooks/useEntregas';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

interface Props {
  fila: EntregaDaFila[];
  carregando: boolean;
  erro: string | null;
  jaNaRota: Set<string>;
  onMontarRota: (ids: string[]) => Promise<ResultadoRpc>;
  onExcluir: (ids: string[]) => Promise<ResultadoRpc>;
}

/**
 * A fila chega do banco já na ordem certa: dívida primeiro, depois bairro do
 * norte pro sul. A tela não reordena nada — só separa a dívida num bloco
 * próprio, porque é o que se perde hoje e precisa doer na vista.
 */
const FilaDeEntregas = ({ fila, carregando, erro, jaNaRota, onMontarRota, onExcluir }: Props) => {
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [montando, setMontando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const divida = useMemo(() => fila.filter((e) => e.situacao === 'nao_entregue'), [fila]);
  const esperando = useMemo(() => fila.filter((e) => e.situacao !== 'nao_entregue'), [fila]);

  // Agrupa mantendo a ordem de chegada, que já é a ordem geográfica.
  const porBairro = useMemo(() => {
    const grupos: { bairro: string; entregas: EntregaDaFila[] }[] = [];
    esperando.forEach((entrega) => {
      const nome = entrega.bairro ?? 'Sem bairro no cadastro';
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.bairro === nome) ultimo.entregas.push(entrega);
      else grupos.push({ bairro: nome, entregas: [entrega] });
    });
    return grupos;
  }, [esperando]);

  const alternar = (id: string) => {
    setEscolhidas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  };

  const escolherTodas = (entregas: EntregaDaFila[]) => {
    setEscolhidas((atual) => {
      const nova = new Set(atual);
      const faltaAlguma = entregas.some((e) => !nova.has(e.id));
      entregas.forEach((e) => (faltaAlguma ? nova.add(e.id) : nova.delete(e.id)));
      return nova;
    });
  };

  const montar = async () => {
    setMontando(true);
    setAviso(null);
    const r = await onMontarRota([...escolhidas]);
    setMontando(false);
    if (!r.ok) {
      setAviso(r.mensagem ?? 'Não foi possível montar a rota.');
      return;
    }
    setEscolhidas(new Set());
  };

  // Exclui o que está na fila, mesmo se já passou por uma rota de outro dia. Fica de
  // fora o que está na rota de hoje e o que o entregador já registrou (voltou).
  // O banco confere de novo; aqui só evita o clique que não teria efeito.
  const idsDaDivida = new Set(divida.map((e) => e.id));
  const podeExcluir =
    escolhidas.size > 0 && [...escolhidas].every((id) => !jaNaRota.has(id) && !idsDaDivida.has(id));

  const excluir = async () => {
    const quantas = escolhidas.size;
    const frase = quantas === 1 ? 'esta entrega' : `estas ${quantas} entregas`;
    if (!window.confirm(`Excluir ${frase}? Se o ERP mandar de novo, voltam a aparecer.`)) return;
    setExcluindo(true);
    setAviso(null);
    const r = await onExcluir([...escolhidas]);
    setExcluindo(false);
    setAviso(r.mensagem ?? null);
    if (r.ok) setEscolhidas(new Set());
  };

  if (carregando && fila.length === 0) return <AdminLoadingState label="Carregando a fila..." />;

  if (erro) {
    return (
      <AdminEmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar a fila"
        description="Tente de novo em instantes. Se insistir, a rota de hoje continua valendo."
      />
    );
  }

  if (fila.length === 0) {
    return (
      <AdminEmptyState
        icon={PackageX}
        title="Nenhuma entrega esperando"
        description="Suba o Excel de Pedidos Pendentes do ERP na aba Importar para a fila encher."
      />
    );
  }

  const Linha = ({ entrega }: { entrega: EntregaDaFila }) => {
    const naRota = jaNaRota.has(entrega.id);
    const marcada = escolhidas.has(entrega.id);
    return (
      <label
        className={`min-h-11 flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
          marcada
            ? 'border-blue-500/50 bg-blue-600/10'
            : 'border-blue-500/10 hover:border-blue-500/30'
        }`}
      >
        <Checkbox
          checked={marcada}
          onCheckedChange={() => alternar(entrega.id)}
          className="mt-1 h-5 w-5 border-blue-500/40 data-[state=checked]:bg-blue-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white truncate">{entrega.cliente_nome}</span>
            {naRota && <SeloEntrega situacao="em_rota" />}
            <SeloTentativa tentativas={entrega.tentativas} />
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-blue-300/55">
            <span className="font-mono tabular-nums">
              {entrega.documento_tipo} {entrega.documento_numero}
            </span>
            <span className="font-mono tabular-nums">{emReais(entrega.valor)}</span>
            {entrega.cliente_telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {entrega.cliente_telefone}
              </span>
            )}
          </div>

          <p className="mt-1 text-xs text-blue-300/70 inline-flex items-start gap-1">
            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{entrega.entregar_em || entrega.endereco || 'Sem endereço no cadastro'}</span>
          </p>

          {entrega.ultimo_motivo && (
            <p className="mt-1 text-xs text-[#ff8a7a]">
              Voltou: {MOTIVO_LABEL[entrega.ultimo_motivo]}
              {entrega.ultima_tentativa && ` · ${diaCurto(entrega.ultima_tentativa.slice(0, 10))}`}
              {entrega.tentativas >= 3 && ' · já foram 3 viagens, vale ligar antes de mandar o carro'}
            </p>
          )}
        </div>
      </label>
    );
  };

  return (
    <div className="space-y-4">
      {divida.length > 0 && (
        <Card className={`${CARD} border-[#C0392B]/40`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#C0392B]" />
              Voltou sem entregar
            </CardTitle>
            <p className="text-xs text-blue-300/50">
              Isto é dívida: mercadoria que saiu e não chegou. Vai no topo da rota de hoje.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {divida.map((entrega) => (
              <Linha key={entrega.id} entrega={entrega} />
            ))}
            <button
              onClick={() => escolherTodas(divida)}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              Marcar todas as que voltaram
            </button>
          </CardContent>
        </Card>
      )}

      {porBairro.map((grupo) => (
        <Card key={grupo.bairro} className={CARD}>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-base text-white">{grupo.bairro}</CardTitle>
            <button
              onClick={() => escolherTodas(grupo.entregas)}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {grupo.entregas.length === 1
                ? 'marcar'
                : `marcar as ${grupo.entregas.length}`}
            </button>
          </CardHeader>
          <CardContent className="space-y-2">
            {grupo.entregas.map((entrega) => (
              <Linha key={entrega.id} entrega={entrega} />
            ))}
          </CardContent>
        </Card>
      ))}

      {aviso && <p className="text-sm text-[#ff8a7a]">{aviso}</p>}

      {/* Fica colado embaixo: no celular, no chão do estoque, a ação não pode
          exigir rolar até o fim de 30 entregas. */}
      <div className="sticky bottom-20 md:bottom-4 z-10 flex gap-2">
        {escolhidas.size > 0 && (
          <Button
            onClick={excluir}
            disabled={!podeExcluir || excluindo || montando}
            variant="outline"
            title={
              podeExcluir
                ? 'Excluir as entregas marcadas'
                : 'Não dá para excluir entrega que está na rota de hoje ou que já voltou'
            }
            className="h-12 shrink-0 border-[#C0392B]/60 bg-[#12121a] text-[#C0392B] hover:bg-[#C0392B]/10"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </Button>
        )}
        <Button
          onClick={montar}
          disabled={escolhidas.size === 0 || montando || excluindo}
          className="flex-1 h-12 bg-blue-600 hover:bg-blue-500 text-white shadow-lg"
        >
          {montando
            ? 'Montando...'
            : escolhidas.size === 0
              ? 'Escolha ao menos uma entrega'
              : `Montar rota com ${escolhidas.size} ${escolhidas.size === 1 ? 'entrega' : 'entregas'}`}
        </Button>
      </div>
    </div>
  );
};

export default FilaDeEntregas;
