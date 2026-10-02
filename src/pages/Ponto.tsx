import { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, Clock, DoorOpen, PackagePlus, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TecladoPin from '@/components/ponto/TecladoPin';
import EscolherPessoa from '@/components/ponto/EscolherPessoa';
import Aviso from '@/components/ponto/Aviso';
import AbrirLoja from '@/components/ponto/AbrirLoja';
import ReportarFaltante from '@/components/ponto/ReportarFaltante';
import {
  usePontoQuiosque,
  TIPO_LABEL,
  type FuncionarioDoQuiosque,
} from '@/hooks/usePontoQuiosque';

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
      <p className="font-mono text-6xl sm:text-8xl font-bold tabular-nums tracking-tight text-foreground">
        {agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
      {/* first-letter e não capitalize: capitalize vira "02 De Outubro De 2026" */}
      <p className="text-base sm:text-lg text-muted-foreground mt-2 first-letter:uppercase">
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
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
  codigo?: string;
}

type Tela = 'inicio' | 'bater-quem' | 'bater-pin' | 'abrir-loja' | 'faltante' | 'manutencao';

const Ponto = () => {
  const {
    token,
    contexto,
    carregando,
    registrarEstacao,
    baterPonto,
    abrirLoja,
    marcarPresentes,
    buscarProduto,
    reportarFaltante,
    sairDoQuiosque,
  } = usePontoQuiosque();

  const [tela, setTela] = useState<Tela>('inicio');
  const [pessoa, setPessoa] = useState<FuncionarioDoQuiosque | null>(null);
  const [pin, setPin] = useState('');
  const [busca, setBusca] = useState('');
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeEstacao, setNomeEstacao] = useState('PC da frente');
  const [erroRegistro, setErroRegistro] = useState<string | null>(null);

  const voltarAoInicio = useCallback(() => {
    setTela('inicio');
    setPessoa(null);
    setPin('');
    setBusca('');
    setAviso(null);
  }, []);

  const mostrarAviso = useCallback(
    (ok: boolean, destaque?: string, detalhe?: string, mensagem?: string, codigo?: string) => {
      setAviso({ ok, destaque, detalhe, mensagem, codigo });
    },
    []
  );

  // Ninguém pode deixar a tela aberta com o nome de outro: sem toque, limpa.
  useEffect(() => {
    if (tela === 'inicio' && !aviso) return;
    const t = setTimeout(voltarAoInicio, SEGUNDOS_ATE_LIMPAR * 1000);
    const resetar = () => clearTimeout(t);
    window.addEventListener('pointerdown', resetar, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', resetar);
    };
  }, [tela, pin, aviso, voltarAoInicio]);

  const confirmarBatida = async () => {
    if (!pessoa || pin.length !== 4) return;
    setEnviando(true);
    const r = await baterPonto(pessoa.id, pin);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      mostrarAviso(false, undefined, undefined, r.mensagem);
      return;
    }

    const hora = r.registrado_em
      ? new Date(r.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    mostrarAviso(
      true,
      hora,
      r.tipo ? TIPO_LABEL[r.tipo] : 'Registrado',
      r.ignorada ? r.mensagem : undefined,
      r.ignorada ? undefined : r.codigo
    );
  };

  const confirmarManutencao = async () => {
    setEnviando(true);
    const r = await sairDoQuiosque(pin);
    setEnviando(false);
    setPin('');
    if (r.ok) {
      window.location.href = '/admin';
      return;
    }
    mostrarAviso(false, undefined, undefined, r.mensagem);
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Clock className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  // PC ainda não registrado: só o admin consegue registrar (a função exige).
  if (!token || contexto?.ok === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-4 text-center">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-heading">Este computador ainda não é uma estação</h1>
        <p className="text-muted-foreground max-w-md">
          Entre como administrador e registre este PC uma vez. Depois disso ele abre direto no
          ponto, inclusive se reiniciar.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
          <Input
            value={nomeEstacao}
            onChange={(e) => setNomeEstacao(e.target.value)}
            placeholder="Nome deste computador"
            className="h-12"
          />
          <Button
            className="h-12"
            onClick={async () => {
              setErroRegistro(null);
              const r = await registrarEstacao(nomeEstacao.trim() || 'Estação');
              if (!r.ok) setErroRegistro(r.mensagem ?? 'Não foi possível registrar.');
            }}
          >
            Registrar este PC
          </Button>
        </div>
        {erroRegistro && <p className="text-sm text-[#C0392B] max-w-sm">{erroRegistro}</p>}
      </div>
    );
  }

  const funcionarios = contexto?.funcionarios ?? [];
  const autorizados = funcionarios.filter((f) => f.pode_abrir_loja);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {aviso && <Aviso {...aviso} onFim={voltarAoInicio} />}

      <header className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-muted-foreground">
          {contexto?.local} · {contexto?.estacao}
        </span>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs',
              contexto?.rede_ok ? 'text-[#2F9E44]' : 'text-[#C0392B]'
            )}
          >
            {contexto?.rede_ok ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {contexto?.rede_ok ? 'rede da loja' : 'fora da rede da loja'}
          </span>
          <button
            type="button"
            onClick={() => {
              setPin('');
              setTela('manutencao');
            }}
            className="text-muted-foreground/40 hover:text-muted-foreground p-1"
            aria-label="Sair do modo quiosque"
          >
            <Unlock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {tela === 'inicio' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-10 p-6">
          <Relogio />
          <div className="w-full max-w-sm flex flex-col gap-3">
            <Button className="h-16 text-xl" onClick={() => setTela('bater-quem')}>
              <Clock className="h-6 w-6 mr-3" />
              Bater ponto
            </Button>
            {/* P20: sem ninguém autorizado, o botão nem aparece. */}
            {autorizados.length > 0 && (
              <Button
                variant="outline"
                className="h-14 text-base"
                onClick={() => setTela('abrir-loja')}
              >
                <DoorOpen className="h-5 w-5 mr-3" />
                Abrir loja
              </Button>
            )}
            <Button
              variant="outline"
              className="h-14 text-base"
              onClick={() => setTela('faltante')}
            >
              <PackagePlus className="h-5 w-5 mr-3" />
              Reportar faltante
            </Button>
          </div>
        </main>
      )}

      {tela === 'bater-quem' && (
        <EscolherPessoa
          funcionarios={funcionarios}
          busca={busca}
          onBusca={setBusca}
          onEscolher={(f) => {
            setPessoa(f);
            setPin('');
            setTela('bater-pin');
          }}
          onVoltar={voltarAoInicio}
        />
      )}

      {tela === 'bater-pin' && pessoa && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading">{pessoa.nome}</p>
            <p className="text-muted-foreground mt-1">Digite seu PIN</p>
          </div>

          <TecladoPin
            valor={pin}
            onChange={setPin}
            onConfirmar={confirmarBatida}
            confirmando={enviando}
          />

          <Button variant="ghost" className="h-12" onClick={voltarAoInicio}>
            Cancelar
          </Button>
        </main>
      )}

      {tela === 'abrir-loja' && (
        <AbrirLoja
          autorizados={autorizados}
          abrirLoja={abrirLoja}
          marcarPresentes={marcarPresentes}
          onFim={mostrarAviso}
          onVoltar={voltarAoInicio}
        />
      )}

      {tela === 'faltante' && (
        <ReportarFaltante
          funcionarios={funcionarios}
          buscarProduto={buscarProduto}
          reportarFaltante={reportarFaltante}
          onFim={mostrarAviso}
          onVoltar={voltarAoInicio}
        />
      )}

      {tela === 'manutencao' && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading">Sair do modo quiosque</p>
            <p className="text-muted-foreground mt-1 max-w-xs">
              PIN de manutenção. Vale só neste computador e dentro da loja.
            </p>
          </div>

          <TecladoPin
            valor={pin}
            onChange={setPin}
            onConfirmar={confirmarManutencao}
            confirmando={enviando}
            tamanho={4}
          />

          <Button variant="ghost" className="h-12" onClick={voltarAoInicio}>
            Cancelar
          </Button>
        </main>
      )}
    </div>
  );
};

export default Ponto;
