import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { CheckCircle2, Package, Route as RouteIcon, Search, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import { ADMIN_NAV_GROUP_LABELS, getVisibleNavItems, type AdminNavGroup } from '@/components/admin/adminNav';
import {
  hojeEmSaoPaulo,
  useFilaDeEntregas,
  useHistoricoDeEntregas,
  useRotaDoDia,
} from '@/hooks/useEntregas';

/**
 * AMOSTRA de visual (não substitui o painel): cartões de vidro fosco sobre um
 * degradê, com os números reais das entregas. Serve para ver na prática antes de
 * decidir se o painel inteiro vai nesse estilo.
 */

const VIDRO = 'rounded-3xl border border-white/50 bg-white/55 shadow-[0_8px_32px_rgba(8,47,73,0.18)] backdrop-blur-xl';
const SOBE = 'transition-transform duration-200 hover:-translate-y-1';
const INK = 'text-[#0c2a40]';

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
    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-[#1573D6]">
      <Icone className="h-[18px] w-[18px]" />
    </span>
    <p className={`mt-4 font-mono text-4xl font-semibold tabular-nums ${INK}`}>{valor}</p>
    <p className={`mt-1 text-sm font-semibold ${INK}`}>{rotulo}</p>
    <p className="text-xs text-[#3b5a73]">{dica}</p>
  </div>
);

export interface DadosDoPainel {
  nome: string;
  naFila: number;
  entreguesHoje: number;
  voltaramHoje: number;
  aCaminho: number;
  paradasTotal: number;
  porDia: { dia: string; rotulo: string; total: number }[];
  itensDoMenu: ReturnType<typeof getVisibleNavItems>;
}

export const PainelVidroView = ({
  nome,
  naFila,
  entreguesHoje,
  voltaramHoje,
  aCaminho,
  paradasTotal,
  porDia,
  itensDoMenu,
}: DadosDoPainel) => {
  const navigate = useNavigate();
  const totalSemana = porDia.reduce((t, d) => t + d.total, 0);
  const rosca = [
    { nome: 'Entregues', valor: entreguesHoje, cor: '#2F9E44' },
    { nome: 'Voltaram', valor: voltaramHoje, cor: '#C0392B' },
    { nome: 'A caminho', valor: aCaminho, cor: '#1573D6' },
  ];
  const temRosca = rosca.some((f) => f.valor > 0);
  const grupos: (AdminNavGroup | undefined)[] = [undefined, 'catalogo', 'operacao', 'equipe'];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a2c47] font-sans">
      {/* O fundo: degradê com manchas de cor desfocadas, é o que o vidro "reflete". */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 12% 8%, #2f86e0 0%, transparent 60%), radial-gradient(55% 55% at 90% 15%, #1573D6 0%, transparent 62%), radial-gradient(60% 60% at 70% 100%, #1b5fb0 0%, transparent 60%), linear-gradient(160deg, #0a3556 0%, #0a2c47 55%, #082338 100%)',
        }}
      />

      <div className="relative mx-auto flex max-w-[1500px] gap-5 p-4 md:p-6">
        {/* Barra lateral flutuante */}
        <aside className={`${VIDRO} hidden w-60 shrink-0 self-start p-4 md:block`}>
          <div className="mb-5 flex items-center gap-3 px-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1573D6] text-sm font-semibold text-white">
              U
            </span>
            <div>
              <p className={`text-sm font-semibold ${INK}`}>Ubadesklimp</p>
              <p className="text-xs text-[#3b5a73]">Painel · amostra</p>
            </div>
          </div>
          <nav className="space-y-4">
            {grupos.map((g) => {
              const doGrupo = itensDoMenu.filter((i) => i.group === g);
              if (doGrupo.length === 0) return null;
              return (
                <div key={g ?? 'topo'}>
                  {g && (
                    <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#4b6a82]">
                      {ADMIN_NAV_GROUP_LABELS[g]}
                    </p>
                  )}
                  {doGrupo.map((item) => {
                    const Icone = item.icon;
                    const ativo = item.key === 'entregas';
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => navigate(`/admin#${item.key}`)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                          ativo
                            ? 'bg-[#1573D6] font-semibold text-white shadow-md'
                            : 'text-[#27465e] hover:bg-white/60'
                        }`}
                      >
                        <Icone className="h-[17px] w-[17px] shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-5">
          {/* Barra de cima */}
          <div className={`${VIDRO} flex items-center gap-3 px-4 py-3`}>
            <Search className="h-4 w-4 text-[#4b6a82]" />
            <span className="flex-1 text-sm text-[#4b6a82]">Buscar cliente, pedido, produto…</span>
            <span className="hidden rounded-full bg-[#0c2a40] px-3 py-1 text-xs font-semibold text-white sm:inline">
              amostra de visual
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1573D6] text-xs font-semibold text-white">
              {(nome || '?').slice(0, 1).toUpperCase()}
            </span>
          </div>

          {/* Painel principal */}
          <div className={`${VIDRO} space-y-5 p-5 md:p-7`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className={`text-2xl font-semibold md:text-3xl ${INK}`}>
                  {saudacao()}
                  {nome && `, ${nome}`}
                </h1>
                <p className="text-sm text-[#3b5a73]">
                  {new Intl.DateTimeFormat('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date())}{' '}
                  · {aCaminho} {aCaminho === 1 ? 'entrega a caminho' : 'entregas a caminho'}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/admin" className="rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-[#27465e] hover:bg-white">
                  Painel atual
                </Link>
                <button
                  type="button"
                  onClick={() => navigate('/admin#entregas')}
                  className="rounded-full bg-[#0c2a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#143a57]"
                >
                  Abrir entregas
                </button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
              {/* Barras: entregas por dia */}
              <div className={`${VIDRO} ${SOBE} p-5`}>
                <p className={`text-sm font-semibold ${INK}`}>Entregas feitas</p>
                <p className="text-xs text-[#3b5a73]">
                  <span className="font-mono tabular-nums">{totalSemana}</span> nos últimos 7 dias
                </p>
                <div className="mt-3 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDia} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: '#4b6a82', fontSize: 12 }} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.35)' }}
                        formatter={(v: number) => [v, 'entregas']}
                        labelFormatter={(_, p) => p?.[0]?.payload?.dia?.split('-').reverse().join('/') ?? ''}
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                        {porDia.map((d, i) => (
                          <Cell key={d.dia} fill={i === porDia.length - 1 ? '#2f94ea' : '#a9c8ea'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Rosca: a rota de hoje */}
              <div className={`${VIDRO} ${SOBE} p-5`}>
                <p className={`text-sm font-semibold ${INK}`}>Rota de hoje</p>
                <p className="text-xs text-[#3b5a73]">Como está cada parada</p>
                <div className="relative mx-auto mt-2 h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={temRosca ? rosca : [{ nome: 'Sem rota', valor: 1, cor: '#c9d9e6' }]}
                        dataKey="valor"
                        innerRadius={50}
                        outerRadius={72}
                        paddingAngle={temRosca ? 3 : 0}
                        stroke="none"
                      >
                        {(temRosca ? rosca : [{ nome: 'Sem rota', valor: 1, cor: '#c9d9e6' }]).map((f) => (
                          <Cell key={f.nome} fill={f.cor} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`font-mono text-3xl font-semibold tabular-nums ${INK}`}>{paradasTotal}</span>
                    <span className="text-[11px] text-[#3b5a73]">paradas</span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-xs text-[#27465e]">
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

  // Entregas por dia nos últimos 7 dias, sem contar marcação desfeita.
  const porDia = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = somarDias(hoje, i - 6);
      const total = semana.registros.filter((r) => r.dia === dia && r.tipo === 'entregue' && !r.desfeita).length;
      const rotulo = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
        .format(new Date(`${dia}T12:00:00Z`))
        .replace('.', '');
      return { dia, rotulo, total };
    });
  }, [semana.registros, hoje]);

  return (
    <PainelVidroView
      nome={nome}
      naFila={fila.fila.length}
      entreguesHoje={entreguesHoje}
      voltaramHoje={voltaramHoje}
      aCaminho={aCaminho}
      paradasTotal={paradas.length}
      porDia={porDia}
      itensDoMenu={getVisibleNavItems(staffAccess, equipeAccess)}
    />
  );
};

export default PainelVidroExemplo;
