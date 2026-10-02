import { useEffect, useState } from 'react';
import { Delete, Wifi, WifiOff, ArrowLeft, Check, X, Clock, DoorOpen, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  usePontoQuiosque,
  TIPO_LABEL,
  type FuncionarioDoQuiosque,
  type ResultadoBatida,
} from '@/hooks/usePontoQuiosque';

/** Volta sozinho pra tela inicial depois disso sem ninguém tocar (PRD 4.6). */
const SEGUNDOS_ATE_LIMPAR = 30;
const SEGUNDOS_DO_COMPROVANTE = 5;

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

/** Teclado grande: o PC da frente é usado em pé e às pressas. */
const TecladoPin = ({
  valor,
  onChange,
  onConfirmar,
  confirmando,
}: {
  valor: string;
  onChange: (v: string) => void;
  onConfirmar: () => void;
  confirmando: boolean;
}) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex justify-center gap-3 mb-6" aria-label="PIN digitado">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-5 w-5 rounded-full border-2 transition-colors',
              valor.length > i ? 'bg-primary border-primary' : 'border-muted-foreground/40'
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {teclas.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => valor.length < 4 && onChange(valor + t)}
            className="h-16 rounded-xl border bg-card text-2xl font-mono font-semibold hover:bg-accent active:scale-95 transition"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(valor.slice(0, -1))}
          className="h-16 rounded-xl border bg-card flex items-center justify-center hover:bg-accent active:scale-95 transition"
          aria-label="Apagar"
        >
          <Delete className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={() => valor.length < 4 && onChange(valor + '0')}
          className="h-16 rounded-xl border bg-card text-2xl font-mono font-semibold hover:bg-accent active:scale-95 transition"
        >
          0
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          disabled={valor.length !== 4 || confirmando}
          className="h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
          aria-label="Confirmar"
        >
          <Check className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

const Comprovante = ({ r, onFim }: { r: ResultadoBatida; onFim: () => void }) => {
  const [restante, setRestante] = useState(SEGUNDOS_DO_COMPROVANTE);

  useEffect(() => {
    if (restante <= 0) {
      onFim();
      return;
    }
    const t = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [restante, onFim]);

  useEffect(() => {
    // vibração curta confirma a batida sem a pessoa precisar ler (PRD seção 6)
    if (r.ok && 'vibrate' in navigator) navigator.vibrate?.(120);
  }, [r.ok]);

  const hora = r.registrado_em
    ? new Date(r.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center',
        r.ok ? 'bg-[#2F9E44] text-white' : 'bg-[#C0392B] text-white'
      )}
      onClick={onFim}
    >
      {r.ok ? <Check className="h-20 w-20 mb-4" /> : <X className="h-20 w-20 mb-4" />}

      {r.ok ? (
        <>
          <p className="font-mono text-7xl font-bold tabular-nums">{hora}</p>
          <p className="text-2xl mt-3">{r.tipo ? TIPO_LABEL[r.tipo] : 'Registrado'}</p>
          {r.ignorada ? (
            <p className="text-lg mt-4 opacity-90 max-w-sm">{r.mensagem}</p>
          ) : (
            <p className="text-sm mt-6 opacity-80 font-mono">comprovante {r.codigo}</p>
          )}
        </>
      ) : (
        <p className="text-2xl max-w-md leading-snug">{r.mensagem}</p>
      )}

      <p className="text-sm opacity-70 mt-8">Toque para voltar · {restante}s</p>
    </div>
  );
};

type Passo = 'inicio' | 'escolher' | 'pin';

const Ponto = () => {
  const { token, contexto, carregando, registrarEstacao, baterPonto } = usePontoQuiosque();
  const [passo, setPasso] = useState<Passo>('inicio');
  const [pessoa, setPessoa] = useState<FuncionarioDoQuiosque | null>(null);
  const [pin, setPin] = useState('');
  const [busca, setBusca] = useState('');
  const [resultado, setResultado] = useState<ResultadoBatida | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nomeEstacao, setNomeEstacao] = useState('PC da frente');
  const [erroRegistro, setErroRegistro] = useState<string | null>(null);

  const voltarAoInicio = () => {
    setPasso('inicio');
    setPessoa(null);
    setPin('');
    setBusca('');
    setResultado(null);
  };

  // Ninguém pode deixar a tela aberta com o nome de outro: sem toque, limpa.
  useEffect(() => {
    if (passo === 'inicio' && !resultado) return;
    const t = setTimeout(voltarAoInicio, SEGUNDOS_ATE_LIMPAR * 1000);
    const resetar = () => clearTimeout(t);
    window.addEventListener('pointerdown', resetar, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointerdown', resetar);
    };
  }, [passo, pin, resultado]);

  const confirmar = async () => {
    if (!pessoa || pin.length !== 4) return;
    setEnviando(true);
    const r = await baterPonto(pessoa.id, pin);
    setEnviando(false);
    setPin('');
    setResultado(r);
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
  const filtrados = funcionarios.filter((f) =>
    f.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {resultado && <Comprovante r={resultado} onFim={voltarAoInicio} />}

      <header className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-muted-foreground">
          {contexto?.local} · {contexto?.estacao}
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            contexto?.rede_ok ? 'text-[#2F9E44]' : 'text-[#C0392B]'
          )}
        >
          {contexto?.rede_ok ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {contexto?.rede_ok ? 'rede da loja' : 'fora da rede da loja'}
        </span>
      </header>

      {passo === 'inicio' && (
        <main className="flex-1 flex flex-col items-center justify-center gap-10 p-6">
          <Relogio />
          <div className="w-full max-w-sm flex flex-col gap-3">
            <Button
              className="h-16 text-xl"
              onClick={() => setPasso('escolher')}
            >
              <Clock className="h-6 w-6 mr-3" />
              Bater ponto
            </Button>
            <Button variant="outline" className="h-14 text-base" disabled>
              <DoorOpen className="h-5 w-5 mr-3" />
              Abrir loja
            </Button>
            <Button variant="outline" className="h-14 text-base" disabled>
              <PackagePlus className="h-5 w-5 mr-3" />
              Reportar faltante
            </Button>
          </div>
        </main>
      )}

      {passo === 'escolher' && (
        <main className="flex-1 flex flex-col p-4 gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-12 w-12" onClick={voltarAoInicio}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar seu nome"
              className="h-12 text-base"
            />
          </div>

          <div className="flex-1 overflow-y-auto grid gap-2 sm:grid-cols-2 content-start">
            {filtrados.length === 0 && (
              <p className="text-muted-foreground p-4">Nenhum nome encontrado.</p>
            )}
            {filtrados.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setPessoa(f);
                  setPin('');
                  setPasso('pin');
                }}
                className="h-16 rounded-xl border bg-card px-4 text-left text-lg hover:bg-accent active:scale-[0.99] transition"
              >
                {f.nome}
              </button>
            ))}
          </div>
        </main>
      )}

      {passo === 'pin' && pessoa && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
          <div className="text-center">
            <p className="text-2xl font-heading">{pessoa.nome}</p>
            <p className="text-muted-foreground mt-1">Digite seu PIN</p>
          </div>

          <TecladoPin
            valor={pin}
            onChange={setPin}
            onConfirmar={confirmar}
            confirmando={enviando}
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
