import { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, Clock, DoorOpen, PackagePlus, Unlock, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Teclado from '@/components/ponto/Teclado';
import Aviso from '@/components/ponto/Aviso';
import Bastidor from '@/components/ponto/Bastidor';
import AbrirLoja from '@/components/ponto/AbrirLoja';
import ReportarFaltante from '@/components/ponto/ReportarFaltante';
import { usePontoInstalavel } from '@/hooks/usePontoInstalavel';
import { usePontoQuiosque, TIPO_LABEL, type Atalho, type FichaDaEstacao } from '@/hooks/usePontoQuiosque';

/** Volta sozinho pra tela inicial depois disso sem ninguém tocar (PRD 4.6). */
const SEGUNDOS_ATE_LIMPAR = 30;

const Relogio = () => {
  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-center">
      <p className="font-mono text-[4.5rem] sm:text-[6rem] leading-none font-bold tabular-nums tracking-tight text-[#141B1E]">
        {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {/* first-letter e não capitalize: capitalize vira "03 De Outubro De 2026" */}
      <p className="text-sm sm:text-base text-[#55605F] mt-3 first-letter:uppercase">
        {agora.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </div>
  );
};

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
  codigo?: string;
}

type Tela = 'ponto' | 'abrir-loja' | 'faltante' | 'manutencao' | 'bastidor';

const Ponto = () => {
  usePontoInstalavel();
  const {
    token,
    contexto,
    carregando,
    registrarEstacao,
    ativarComCodigo,
    baterPontoPorPin,
    abrirLojaPorPin,
    marcarPresentesPorPin,
    buscarProduto,
    reportarFaltantesPorPin,
    abrirBastidor,
    salvarAtalhos,
    voltarAoModoFacil,
  } = usePontoQuiosque();

  const [tela, setTela] = useState<Tela>('ponto');
  const [pin, setPin] = useState('');
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeEstacao, setNomeEstacao] = useState('PC da frente');
  const [codigoEstacao, setCodigoEstacao] = useState('');
  const [ativando, setAtivando] = useState(false);
  const [erroRegistro, setErroRegistro] = useState<string | null>(null);
  const [ficha, setFicha] = useState<FichaDaEstacao | null>(null);
  const [pinBastidor, setPinBastidor] = useState('');

  const voltarAoInicio = useCallback(() => {
    setTela('ponto');
    setPin('');
    setAviso(null);
  }, []);

  const mostrarAviso = useCallback((a: AvisoAtual) => setAviso(a), []);

  // Esc volta pro ponto de qualquer canto do quiosque. Quem está no balcão
  // desiste no teclado, não procurando o botão de voltar.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      voltarAoInicio();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [voltarAoInicio]);

  // Ninguém pode deixar meio PIN digitado na tela: sem toque, limpa.
  useEffect(() => {
    if (tela === 'ponto' && !pin && !aviso) return;
    const t = setTimeout(voltarAoInicio, SEGUNDOS_ATE_LIMPAR * 1000);
    const resetar = () => clearTimeout(t);
    window.addEventListener('pointerdown', resetar, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', resetar);
    };
  }, [tela, pin, aviso, voltarAoInicio]);

  const baterPonto = async () => {
    if (pin.length !== 4) return;
    setEnviando(true);
    const r = await baterPontoPorPin(pin);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      mostrarAviso({ ok: false, mensagem: r.mensagem });
      return;
    }

    const hora = r.registrado_em
      ? new Date(r.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    mostrarAviso({
      ok: true,
      nome: r.nome,
      destaque: hora,
      detalhe: r.tipo ? TIPO_LABEL[r.tipo] : 'Registrado',
      mensagem: r.ignorada ? r.mensagem : undefined,
      codigo: r.ignorada ? undefined : r.codigo,
    });
  };

  const confirmarManutencao = async () => {
    setEnviando(true);
    const r = await abrirBastidor(pin);
    setEnviando(false);
    if (r.ok) {
      setFicha(r);
      setPinBastidor(pin);
      setPin('');
      setTela('bastidor');
      return;
    }
    setPin('');
    mostrarAviso({ ok: false, mensagem: r.mensagem });
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F3]">
        <Clock className="h-8 w-8 animate-pulse text-[#55605F]" />
      </div>
    );
  }

  // PC ainda não registrado. O caminho principal é o código gerado no painel:
  // assim ninguém precisa logar a conta de admin neste computador.
  if (!token || contexto?.ok === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F6F3] text-[#141B1E] p-6 gap-5 text-center">
        <Clock className="h-12 w-12 text-[#55605F]" />
        <div>
          <h1 className="text-2xl font-heading">Este computador ainda não bate ponto</h1>
          <p className="text-[#55605F] max-w-md mt-2">
            No painel, em <span className="text-[#141B1E]">Ponto → Preparar um computador</span>,
            saem seis números. Digite eles aqui.
          </p>
        </div>

        <div className="w-full max-w-xs">
          <Input
            value={codigoEstacao}
            onChange={(e) => setCodigoEstacao(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder="000000"
            className="h-16 text-center font-mono text-3xl tracking-[0.3em] bg-white border-[#DCDFD8]"
          />
          <Button
            className="h-14 text-lg w-full mt-3 bg-primary hover:bg-primary/90"
            disabled={codigoEstacao.length !== 6 || ativando}
            onClick={async () => {
              setErroRegistro(null);
              setAtivando(true);
              const r = await ativarComCodigo(codigoEstacao);
              setAtivando(false);
              if (r.ok) setCodigoEstacao('');
              else setErroRegistro(r.mensagem ?? 'Não foi possível ativar.');
            }}
          >
            {ativando && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            Ativar este computador
          </Button>
        </div>

        {erroRegistro && <p className="text-sm text-[#C0392B] max-w-sm">{erroRegistro}</p>}

        <details className="max-w-sm w-full text-left">
          <summary className="text-sm text-[#55605F] cursor-pointer text-center">
            Estou logado como administrador neste PC
          </summary>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Input
              value={nomeEstacao}
              onChange={(e) => setNomeEstacao(e.target.value)}
              placeholder="Nome deste computador"
              className="h-12 bg-white border-[#DCDFD8]"
            />
            <Button
              variant="outline"
              className="h-12"
              onClick={async () => {
                setErroRegistro(null);
                const r = await registrarEstacao(nomeEstacao.trim() || 'Estação');
                if (!r.ok) setErroRegistro(r.mensagem ?? 'Não foi possível registrar.');
              }}
            >
              Registrar
            </Button>
          </div>
        </details>
      </div>
    );
  }

  const atalhos = (contexto?.atalhos ?? ['bater_ponto', 'abrir_loja', 'reportar_faltante']) as Atalho[];
  const temQuemAbra = (contexto?.funcionarios ?? []).some((f) => f.pode_abrir_loja);
  const mostraAbrirLoja = atalhos.includes('abrir_loja') && temQuemAbra;
  const mostraFaltante = atalhos.includes('reportar_faltante');
  const secundaria = tela !== 'ponto';

  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#141B1E] flex flex-col">
      {aviso && <Aviso {...aviso} onFim={voltarAoInicio} />}

      <header className="flex items-center justify-between px-5 py-3.5">
        <span className="text-xs text-[#8A9290] tracking-wide">
          {contexto?.local} · {contexto?.estacao}
        </span>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs',
              contexto?.rede_ok ? 'text-[#2F9E44]' : 'text-[#C0392B]'
            )}
          >
            {contexto?.rede_ok ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {contexto?.rede_ok ? 'rede da loja' : 'fora da rede'}
          </span>
          <button
            type="button"
            onClick={() => {
              setPin('');
              setTela('manutencao');
            }}
            className="text-[#8A9290]/50 hover:text-[#55605F] p-1"
            aria-label="Sair do modo quiosque"
          >
            <Unlock className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ---------------------------------------------- bater ponto: o centro */}
      {tela === 'ponto' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-9 px-6 pb-4">
          <Relogio />

          <div className="w-full">
            <p className="text-center text-sm text-[#55605F] mb-5">
              Digite seu PIN para bater o ponto
            </p>
            <Teclado
              valor={pin}
              onChange={setPin}
              onConfirmar={baterPonto}
              confirmando={enviando}
            />
          </div>
        </main>
      )}

      {tela === 'abrir-loja' && (
        <AbrirLoja
          abrirLoja={abrirLojaPorPin}
          marcarPresentes={marcarPresentesPorPin}
          onFim={mostrarAviso}
          onVoltar={voltarAoInicio}
        />
      )}

      {tela === 'faltante' && (
        <ReportarFaltante
          buscarProduto={buscarProduto}
          reportarFaltantes={reportarFaltantesPorPin}
          onFim={mostrarAviso}
          onVoltar={voltarAoInicio}
        />
      )}

      {tela === 'bastidor' && ficha && (
        <Bastidor
          ficha={ficha}
          salvarAtalhos={(a) => salvarAtalhos(pinBastidor, a)}
          onModoFacil={() => {
            setPinBastidor('');
            setFicha(null);
            voltarAoModoFacil();
            voltarAoInicio();
          }}
          onAbrirPainel={() => {
            window.location.href = '/admin';
          }}
        />
      )}

      {tela === 'manutencao' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
          <div className="text-center">
            <p className="text-xl font-heading">Sair do modo quiosque</p>
            <p className="text-sm text-[#55605F] mt-1.5 max-w-xs">
              PIN de manutenção. Vale só neste computador e dentro da loja.
            </p>
          </div>

          <Teclado
            valor={pin}
            onChange={setPin}
            onConfirmar={confirmarManutencao}
            confirmando={enviando}
            tom="loja"
          />

          <button
            type="button"
            onClick={voltarAoInicio}
            className="text-sm text-[#55605F] hover:text-[#141B1E] py-2 px-4"
          >
            Cancelar
          </button>
        </main>
      )}

      {/* ------------------------------------- resto: rodapé, fora do caminho */}
      <footer className={cn('px-5 pb-5 pt-2', tela === 'bastidor' && 'hidden')}>
        {secundaria ? (
          <button
            type="button"
            onClick={voltarAoInicio}
            className="flex items-center gap-2 text-sm text-[#55605F] hover:text-[#141B1E] py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao ponto
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 border-t border-[#DCDFD8] pt-4">
            {mostraAbrirLoja && (
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setTela('abrir-loja');
                }}
                className="flex items-center gap-2 text-sm text-[#55605F] hover:text-[#141B1E] hover:bg-white rounded-xl px-4 py-3 transition"
              >
                <DoorOpen className="h-4 w-4" />
                Abrir loja
              </button>
            )}
            {mostraFaltante && (
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setTela('faltante');
                }}
                className="flex items-center gap-2 text-sm text-[#55605F] hover:text-[#141B1E] hover:bg-white rounded-xl px-4 py-3 transition"
              >
                <PackagePlus className="h-4 w-4" />
                Reportar faltante
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};

export default Ponto;
