import { useMemo, useState } from 'react';
import { Loader2, Route, AlertTriangle, PackageX, Truck, Smartphone, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminStatCard from '@/components/admin/AdminStatCard';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import {
  hojeEmSaoPaulo,
  useBairrosDeEntrega,
  useFilaDeEntregas,
  useRotaDoDia,
} from '@/hooks/useEntregas';
import FilaDeEntregas from './FilaDeEntregas';
import RotaDoDiaPainel from './RotaDoDiaPainel';
import ImportarEntregas from './ImportarEntregas';
import BairrosEntrega from './BairrosEntrega';

type Aba = 'rota' | 'fila' | 'importar' | 'bairros';

/**
 * Quem entrega tem conta da equipe, e logado a tela descobre a loja sozinha.
 * Este link é o plano B: celular emprestado, aparelho de outra loja, ou alguém
 * que ainda não entrou — abre uma vez e o aparelho lembra.
 */
const LinkDoEntregador = ({ empresaId }: { empresaId: string }) => {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/entregas?loja=${empresaId}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-blue-500/15 bg-[#0c0c14] px-4 py-3">
      <Smartphone className="h-4 w-4 shrink-0 text-blue-400" />
      <p className="min-w-0 flex-1 text-xs text-blue-300/60">
        Quem tem conta da equipe só abre <span className="font-mono">/entregas</span> e digita o PIN
        — a loja vem do cadastro. Este link é para celular sem conta: manda no WhatsApp, ele abre
        uma vez e o aparelho lembra.
      </p>
      <Button
        onClick={copiar}
        variant="outline"
        className="h-11 shrink-0 border-blue-500/30 bg-[#12121a] text-blue-300 hover:bg-blue-600/10"
      >
        {copiado ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
        {copiado ? 'Copiado' : 'Copiar o link'}
      </Button>
    </div>
  );
};

const EntregasManager = () => {
  const equipeAccess = useEquipeAccess();
  const empresaAtiva = equipeAccess.empresaIds[0] ?? null;
  const [hoje] = useState(hojeEmSaoPaulo);
  const [aba, setAba] = useState<Aba>('rota');

  const fila = useFilaDeEntregas(empresaAtiva);
  const rota = useRotaDoDia(empresaAtiva, hoje);
  const bairros = useBairrosDeEntrega(empresaAtiva);

  const jaNaRota = useMemo(
    () => new Set((rota.rota?.paradas ?? []).map((p) => p.entrega_id)),
    [rota.rota]
  );

  const divida = fila.fila.filter((e) => e.situacao === 'nao_entregue');
  const insistindo = divida.filter((e) => e.tentativas >= 3);

  if (equipeAccess.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!equipeAccess.isGestorOuAdmin) {
    return (
      <AdminEmptyState
        icon={Route}
        title="Sem acesso às entregas"
        description="Só gestor ou admin monta a rota do dia. Quem entrega marca pelo celular, em /entregas, com o PIN do ponto."
      />
    );
  }

  if (!empresaAtiva) {
    return (
      <AdminEmptyState
        icon={Route}
        title="Nenhuma empresa vinculada a você"
        description="Cadastre a empresa em Equipe → Configurações antes de montar rota de entrega."
      />
    );
  }

  const montarRota = async (ids: string[]) => {
    const r = await rota.montarRota(ids);
    if (r.ok) {
      await fila.recarregar();
      setAba('rota');
    }
    return r;
  };

  return (
    <div>
      <AdminPageHeader
        icon={Route}
        title="Entregas"
        description="A rota do dia, o que voltou sem entregar, e o que ainda espera na fila."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminStatCard
          icon={PackageX}
          label="Na fila"
          value={fila.fila.length}
          hint="esperando sair"
        />
        <AdminStatCard
          icon={AlertTriangle}
          label="Voltou sem entregar"
          value={divida.length}
          hint={divida.length === 0 ? 'nada pendente' : 'vai no topo da rota'}
        />
        <AdminStatCard
          icon={Truck}
          label="Na rota de hoje"
          value={rota.rota?.existe ? (rota.rota.paradas?.length ?? 0) : 0}
          hint={rota.rota?.invertida ? 'do sul para o norte' : 'do norte para o sul'}
        />
        <AdminStatCard
          icon={AlertTriangle}
          label="3 viagens ou mais"
          value={insistindo.length}
          hint={insistindo.length === 0 ? '—' : 'ligar antes de mandar o carro'}
        />
      </div>

      <LinkDoEntregador empresaId={empresaAtiva} />

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList className="bg-[#0c0c14] border border-blue-500/15">
          <TabsTrigger value="rota">Rota de hoje</TabsTrigger>
          <TabsTrigger value="fila">
            Fila{fila.fila.length > 0 && ` (${fila.fila.length})`}
          </TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
          <TabsTrigger value="bairros">Bairros</TabsTrigger>
        </TabsList>

        <TabsContent value="rota" className="mt-4 space-y-4">
          <RotaDoDiaPainel
            rota={rota.rota}
            carregando={rota.carregando}
            data={hoje}
            onInverter={rota.inverterRota}
            onMover={rota.moverParadas}
            onRecarregar={rota.recarregar}
            onIrParaFila={() => setAba('fila')}
          />
        </TabsContent>

        <TabsContent value="fila" className="mt-4 space-y-4">
          <FilaDeEntregas
            fila={fila.fila}
            carregando={fila.carregando}
            erro={fila.erro}
            jaNaRota={jaNaRota}
            onMontarRota={montarRota}
          />
        </TabsContent>

        <TabsContent value="importar" className="mt-4 space-y-4">
          <ImportarEntregas
            onImportar={rota.importarLote}
            onDepoisDeImportar={fila.recarregar}
            bairrosConhecidos={bairros.bairros}
            onAdicionarBairro={bairros.adicionarBairro}
          />
        </TabsContent>

        <TabsContent value="bairros" className="mt-4 space-y-4">
          <BairrosEntrega
            bairros={bairros.bairros}
            carregando={bairros.carregando}
            onGravarOrdem={bairros.gravarOrdem}
            onAdicionar={bairros.adicionarBairro}
            onAlternarAtivo={bairros.alternarAtivo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EntregasManager;
