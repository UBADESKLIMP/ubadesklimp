import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { CheckCircle2, Package, Route as RouteIcon, Search, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import { ADMIN_NAV_GROUP_LABELS, getVisibleNavItems, type AdminNavGroup } from '@/components/admin/adminNav';
import QuadroDeEntregas from '@/components/entregas/QuadroDeEntregas';
import { nomeCurto } from '@/lib/nomeCurto';
import {
  hojeEmSaoPaulo,
  useFilaDeEntregas,
  useHistoricoDeEntregas,
  useRotaDoDia,
  type EntregaDaFila,
  type ParadaDaRota,
  type RegistroDoHistorico,
  type ResultadoRpc,
} from '@/hooks/useEntregas';

/**
 * AMOSTRA de visual (não substitui o painel): a mesma estrutura do painel atual
 * (barra fina colada na lateral, que abre ao passar o mouse), mas com cartões de
 * vidro escuro sobre um degradê azul. Usa os números reais das entregas.
 */

const ACENTO = '#4C9BFF';
const VIDRO =
  'rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.10] to-white/[0.03] shadow-[0_8px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl';
const SOBE = 'transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.09]';

const somarDias = (iso: string, dias: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const saudacao = () => {
  const h = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date())
  );
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

const Cartao = ({
  icone: Icone,
  valor,
  rotulo,
  dica,
}: {
  icone: typeof Package;
  valor: number;
  rotulo: string;
  dica: string;
}) => (
  <div className={`${VIDRO} ${SOBE} p-5`}>
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10" style={{ color: ACENTO }}>
      <Icone className="h-[18px] w-[18px]" />
    </span>
    <p className="mt-4 font-mono text-4xl font-semibold tabular-nums text-white">{valor}</p>
    <p className="mt-1 text-sm font-semibold text-white/90">{rotulo}</p>
    <p className="text-xs text-white/55">{dica}</p>
  </div>
);

type Barra = { chave: string; rotulo: string; total: number };

export interface DadosDoPainel {
  nome: string;
  naFila: number;
  entreguesHoje: number;
  voltaramHoje: number;
  aCaminho: number;
  paradasTotal: number;
  porHora: Barra[];
  porDia: Barra[];
  itensDoMenu: ReturnType<typeof getVisibleNavItems>;
  fila: EntregaDaFila[];
  paradas: ParadaDaRota[];
  recentes: RegistroDoHistorico[];
  onParaRota: (entregaId: string) => Promise<ResultadoRpc>;
  onParaFila: (paradaId: string) => Promise<ResultadoRpc>;
  onReverter: (paradaId: string) => Promise<ResultadoRpc>;
}

export const PainelVidroView = ({
  nome,
  naFila,
  entreguesHoje,
  voltaramHoje,
  aCaminho,
  paradasTotal,
  porHora,
  porDia,
  itensDoMenu,
  fila,
  paradas,
  recentes,
  onParaRota,
  onParaFila,
  onReverter,
}: DadosDoPainel) => {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<'hoje' | '7dias'>('hoje');
  const [aberta, setAberta] = useState(false);

  const barras = periodo === 'hoje' ? porHora : porDia;
  const totalPeriodo = barras.reduce((t, b) => t + b.total, 0);
  const rosca = [
    { nome: 'Entregues', valor: entreguesHoje, cor: '#3DBE6B' },
    { nome: 'Voltaram', valor: voltaramHoje, cor: '#FF6B5B' },
    { nome: 'A caminho', valor: aCaminho, cor: ACENTO },
  ];
  const temRosca = rosca.some((f) => f.valor > 0);
  const fatias = temRosca ? rosca : [{ nome: 'Sem rota', valor: 1, cor: 'rgba(255,255,255,0.12)' }];
  const grupos: (AdminNavGroup | undefined)[] = [undefined, 'catalogo', 'operacao', 'equipe'];

  return (
    <div className="relative flex min-h-screen bg-[#06121f] text-white">
      {/* Fundo: degradê azul escuro com manchas suaves, é o que o vidro "reflete". */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <span className="absolute -left-24 top-[38%] h-72 w-72 rounded-full bg-[#1573D6]/40 blur-3xl" />
        <span className="absolute right-[8%] top-[18%] h-56 w-56 rounded-full bg-[#29b6f6]/30 blur-3xl" />
        <span className="absolute bottom-[-6rem] right-[22%] h-80 w-80 rounded-full bg-[#4C9BFF]/30 blur-3xl" />
        <span className="absolute bottom-[12%] left-[30%] h-44 w-44 rounded-full bg-[#f5a524]/15 blur-3xl" />
      </div>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(50% 45% at 8% 0%, rgba(47,134,224,0.45) 0%, transparent 70%), radial-gradient(45% 45% at 95% 10%, rgba(21,115,214,0.40) 0%, transparent 70%), radial-gradient(50% 50% at 75% 100%, rgba(27,95,176,0.35) 0%, transparent 70%), linear-gradient(170deg, #0a1d33 0%, #06121f 60%, #040d17 100%)',
        }}
      />

      {/* Barra lateral: colada na lateral, fina, abre ao passar o mouse (como a de hoje). */}
      <aside
        onMouseEnter={() => setAberta(true)}
        onMouseLeave={() => setAberta(false)}
        className={`relative z-10 hidden h-screen shrink-0 self-start overflow-hidden border-r border-white/10 bg-[#07182a]/70 py-4 backdrop-blur-xl transition-[width] duration-200 ease-out md:sticky md:top-0 md:flex md:flex-col ${
          aberta ? 'w-56' : 'w-[60px]'
        }`}
      >
        <div className="mb-5 flex h-9 items-center gap-3 px-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1573D6] text-sm font-semibold text-white">
            U
          </span>
          <span className={`whitespace-nowrap text-sm font-semibold transition-opacity ${aberta ? 'opacity-100' : 'opacity-0'}`}>
            Ubadesklimp
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2">
          {grupos.map((g, idx) => {
            const doGrupo = itensDoMenu.filter((i) => i.group === g);
            if (doGrupo.length === 0) return null;
            return (
              <div key={g ?? 'topo'} className={idx > 0 ? 'mt-3' : undefined}>
                {g && (
                  <div
                    className={`mb-1 flex h-3 items-end px-2 text-[10px] font-medium uppercase leading-none tracking-wider text-white/40 transition-opacity ${
                      aberta ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    {ADMIN_NAV_GROUP_LABELS[g]}
                  </div>
                )}
                {doGrupo.map((item) => {
                  const Icone = item.icon;
                  const ativo = item.key === 'home';
                  return (
                    <button
                      key={item.key}
                      type="button"
                      title={item.label}
                      onClick={() => navigate(item.key === 'home' ? '/admin' : `/admin#${item.key}`)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        ativo ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/[0.07] hover:text-white'
                      }`}
                    >
                      {ativo && <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r" style={{ background: ACENTO }} />}
                      <Icone className="h-[18px] w-[18px] shrink-0" />
                      <span className={`whitespace-nowrap transition-opacity ${aberta ? 'opacity-100' : 'opacity-0'}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Barra de cima: fina, como a de hoje. */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#07182a]/50 px-4 py-3 backdrop-blur-xl md:px-8">
          <Search className="h-4 w-4 text-white/40" />
          <span className="flex-1 text-sm text-white/40">Buscar cliente, pedido, produto…</span>
          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 sm:inline">amostra de visual</span>
          <Link to="/admin" className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10">
            Painel atual
          </Link>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1573D6] text-xs font-semibold">
            {(nome || '?').slice(0, 1).toUpperCase()}
          </span>
        </div>

        <main className="space-y-5 p-4 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold md:text-3xl">
                {saudacao()}
                {nome && `, ${nome}`}
              </h1>
              <p className="text-sm text-white/60">
                {new Intl.DateTimeFormat('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'America/Sao_Paulo',
                }).format(new Date())}{' '}
                · {aCaminho} {aCaminho === 1 ? 'entrega a caminho' : 'entregas a caminho'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/admin#entregas')}
              className="rounded-lg bg-[#1573D6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F5CB0]"
            >
              Abrir entregas
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            {/* Barras: o dia (por hora) ou a semana (por dia) */}
            <div className={`${VIDRO} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Entregas feitas</p>
                  <p className="text-xs text-white/55">
                    <span className="font-mono tabular-nums text-white/80">{totalPeriodo}</span>{' '}
                    {periodo === 'hoje' ? 'hoje, hora a hora' : 'nos últimos 7 dias'}
                  </p>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5 text-xs">
                  {(
                    [
                      ['hoje', 'Hoje'],
                      ['7dias', '7 dias'],
                    ] as const
                  ).map(([valor, rotulo]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setPeriodo(valor)}
                      className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                        periodo === valor ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'
                      }`}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barras} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                    <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                      contentStyle={{
                        background: '#0b2238',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [v, 'entregas']}
                    />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {barras.map((b, i) => (
                        <Cell key={b.chave} fill={i === barras.length - 1 && periodo === '7dias' ? ACENTO : 'rgba(76,155,255,0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rosca: a rota de hoje */}
            <div className={`${VIDRO} p-5`}>
              <p className="text-sm font-semibold">Rota de hoje</p>
              <p className="text-xs text-white/55">Como está cada parada</p>
              <div className="relative mx-auto mt-2 h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={fatias} dataKey="valor" innerRadius={50} outerRadius={72} paddingAngle={temRosca ? 3 : 0} stroke="none">
                      {fatias.map((f) => (
                        <Cell key={f.nome} fill={f.cor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono text-3xl font-semibold tabular-nums">{paradasTotal}</span>
                  <span className="text-[11px] text-white/55">paradas</span>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-white/75">
                {rosca.map((f) => (
                  <li key={f.nome} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: f.cor }} />
                      {f.nome}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">{f.valor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <Cartao icone={Package} valor={naFila} rotulo="Na fila" dica="esperando entrar em rota" />
            <Cartao icone={RouteIcon} valor={aCaminho} rotulo="A caminho" dica="na rua agora" />
            <Cartao icone={CheckCircle2} valor={entreguesHoje} rotulo="Entregues hoje" dica="marcadas pelo motorista" />
            <Cartao icone={Undo2} valor={voltaramHoje} rotulo="Voltaram hoje" dica="não deu para entregar" />
          </div>

          {/* Quadro: arrastar muda a entrega de verdade, e dá para desfazer arrastando de volta. */}
          <div className={`${VIDRO} p-5`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Quadro de entregas</p>
                <p className="text-xs text-white/55">
                  Arraste para mandar à rota, tirar dela ou voltar uma marcação errada. Vale de verdade.
                </p>
              </div>
            </div>
            <QuadroDeEntregas fila={fila} paradas={paradas} onParaRota={onParaRota} onParaFila={onParaFila} onReverter={onReverter} />
          </div>

          <div className={`${VIDRO} p-5`}>
            <p className="text-sm font-semibold">Últimas marcações</p>
            <p className="mb-2 text-xs text-white/55">O que o motorista registrou, do mais recente para o mais antigo.</p>
            {recentes.length === 0 ? (
              <p className="py-4 text-center text-xs text-white/40">Nada registrado nos últimos dias.</p>
            ) : (
              <ul className="divide-y divide-white/10">
                {recentes.map((r) => (
                  <li key={r.evento_id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-white/55">
                      {r.dia.slice(8, 10)}/{r.dia.slice(5, 7)} {r.hora}
                    </span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: r.tipo === 'entregue' ? '#3DBE6B' : r.tipo === 'revertida' ? '#f5a524' : '#FF6B5B' }}
                    />
                    <span className="min-w-0 flex-1 truncate">{nomeCurto(r.cliente_nome)}</span>
                    <span className="hidden text-xs text-white/55 sm:inline">
                      {r.tipo === 'entregue' ? 'entregue' : r.tipo === 'revertida' ? 'desfeita' : 'voltou'} · {r.entregador}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const PainelVidroExemplo = () => {
  const { user } = useAuth();
  const staffAccess = useStaffAccess();
  const equipeAccess = useEquipeAccess();
  const empresaId = equipeAccess.empresaIds[0] ?? null;
  const hoje = hojeEmSaoPaulo();

  const [nome, setNome] = useState('');
  useEffect(() => {
    if (!user) return;
    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setNome((data?.display_name ?? '').split(' ')[0]));
  }, [user]);

  const fila = useFilaDeEntregas(empresaId);
  const rota = useRotaDoDia(empresaId, hoje);
  const semana = useHistoricoDeEntregas(empresaId, somarDias(hoje, -6), hoje);

  const paradas = rota.rota?.paradas ?? [];
  const entreguesHoje = paradas.filter((p) => p.situacao === 'entregue').length;
  const voltaramHoje = paradas.filter((p) => p.situacao === 'nao_entregue').length;
  const aCaminho = paradas.filter((p) => p.situacao === 'em_rota').length;

  // Marcação desfeita pelo escritório não conta como entrega feita.
  const feitas = useMemo(
    () => semana.registros.filter((r) => r.tipo === 'entregue' && !r.desfeita),
    [semana.registros]
  );

  const porDia = useMemo<Barra[]>(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const dia = somarDias(hoje, i - 6);
        const rotulo = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
          .format(new Date(`${dia}T12:00:00Z`))
          .replace('.', '');
        return { chave: dia, rotulo, total: feitas.filter((r) => r.dia === dia).length };
      }),
    [feitas, hoje]
  );

  // Hoje, hora a hora: do expediente (8h às 18h), alargando se alguém entregou fora dele.
  const porHora = useMemo<Barra[]>(() => {
    const dasHoje = feitas.filter((r) => r.dia === hoje).map((r) => Number(r.hora.slice(0, 2)));
    const de = Math.min(8, ...dasHoje);
    const ate = Math.max(18, ...dasHoje);
    return Array.from({ length: ate - de + 1 }, (_, i) => {
      const h = de + i;
      return { chave: String(h), rotulo: `${h}h`, total: dasHoje.filter((x) => x === h).length };
    });
  }, [feitas, hoje]);

  const recentes = useMemo(() => semana.registros.slice(0, 6), [semana.registros]);

  // Cada arrasto chama a mesma regra do painel de hoje e recarrega o que mudou.
  const paraRota = async (entregaId: string) => {
    const r = await rota.montarRota([entregaId]);
    if (r.ok) await fila.recarregar();
    return r;
  };
  const paraFila = async (paradaId: string) => {
    const r = await rota.tirarDaRota(paradaId);
    if (r.ok) await fila.recarregar();
    return r;
  };
  const reverter = async (paradaId: string) => {
    const r = await rota.reverterParada(paradaId);
    if (r.ok) await semana.recarregar();
    return r;
  };

  return (
    <PainelVidroView
      nome={nome}
      naFila={fila.fila.length}
      entreguesHoje={entreguesHoje}
      voltaramHoje={voltaramHoje}
      aCaminho={aCaminho}
      paradasTotal={paradas.length}
      porHora={porHora}
      porDia={porDia}
      itensDoMenu={getVisibleNavItems(staffAccess, equipeAccess)}
      fila={fila.fila}
      paradas={paradas}
      recentes={recentes}
      onParaRota={paraRota}
      onParaFila={paraFila}
      onReverter={reverter}
    />
  );
};

export default PainelVidroExemplo;
