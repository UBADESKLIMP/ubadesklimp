import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QrCode, Wifi, WifiOff, Clock, Smartphone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TecladoPin from '@/components/ponto/TecladoPin';
import EscolherPessoa from '@/components/ponto/EscolherPessoa';
import Aviso from '@/components/ponto/Aviso';
import { usePontoInstalavel } from '@/hooks/usePontoInstalavel';
import { usePontoQr, type PessoaDoQr, type StatusDispositivo } from '@/hooks/usePontoQr';
import { TIPO_LABEL, type MarcacaoTipo } from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
  codigo?: string;
}

type Passo = 'quem' | 'pin' | 'liberar';

/**
 * Tela do QR impresso (PRD 4.2). Vive no celular da pessoa, aberta pela câmera
 * nativa — por isso é a tela mais estreita do sistema e a que mais precisa
 * caber num Android simples de 360 px.
 */
const PontoQr = () => {
  usePontoInstalavel();
  const { token } = useParams<{ token: string }>();
  const { contexto, carregando, statusDoDispositivo, registrarDispositivo, bater } =
    usePontoQr(token);

  const [passo, setPasso] = useState<Passo>('quem');
  const [pessoa, setPessoa] = useState<PessoaDoQr | null>(null);
  const [busca, setBusca] = useState('');
  const [pin, setPin] = useState('');
  const [apelido, setApelido] = useState('');
  const [status, setStatus] = useState<StatusDispositivo>('novo');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);

  const voltar = () => {
    setPasso('quem');
    setPessoa(null);
    setPin('');
    setBusca('');
    setAviso(null);
  };

  const escolher = async (p: PessoaDoQr) => {
    setPessoa(p);
    setPin('');
    const s = await statusDoDispositivo(p.id);
    setStatus(s);
    setPasso(s === 'aprovado' ? 'pin' : 'liberar');
  };

  const confirmarBatida = async () => {
    if (!pessoa || pin.length !== 4) return;
    setEnviando(true);
    const r = await bater(pessoa.id, pin, sugerida);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      setAviso({ ok: false, mensagem: r.mensagem });
      return;
    }

    const hora = r.registrado_em
      ? new Date(r.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    setAviso({
      ok: true,
      destaque: hora,
      detalhe: r.tipo ? TIPO_LABEL[r.tipo] : 'Registrado',
      mensagem: r.ignorada ? r.mensagem : undefined,
      codigo: r.ignorada ? undefined : r.codigo,
    });
  };

  const confirmarLiberacao = async () => {
    if (!pessoa || pin.length !== 4) return;
    setEnviando(true);
    const r = await registrarDispositivo(pessoa.id, pin, apelido.trim() || undefined);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      setAviso({ ok: false, mensagem: r.mensagem });
      return;
    }
    if (r.status === 'aprovado') {
      setStatus('aprovado');
      setPasso('pin');
      return;
    }
    setAviso({ ok: true, destaque: 'Pedido enviado', mensagem: r.mensagem });
  };

  useEffect(() => {
    document.title = 'Bater ponto · Ubadesklimp';
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Clock className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!contexto?.ok) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 gap-4 text-center">
        <QrCode className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-heading">Este QR não vale mais</h1>
        <p className="text-muted-foreground max-w-xs">
          O código foi trocado. Peça o novo para o gestor e cole no lugar deste.
        </p>
      </div>
    );
  }

  // O QR da cozinha só aceita pausa; a sugestão sai do que o local permite.
  const permitidas = (contexto.marcacoes ?? []) as MarcacaoTipo[];
  const sugerida = permitidas.includes('saida_pausa') ? undefined : permitidas[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {aviso && <Aviso {...aviso} onFim={voltar} />}

      <header className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
          <QrCode className="h-4 w-4" />
          {contexto.local}
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            contexto.rede_ok ? 'text-[#2F9E44]' : 'text-[#C0392B]'
          )}
        >
          {contexto.rede_ok ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          {contexto.rede_ok ? 'rede da loja' : 'fora da rede da loja'}
        </span>
      </header>

      {!contexto.rede_ok && (
        <p className="bg-[#C0392B]/10 text-[#C0392B] text-sm px-4 py-3 text-center">
          Conecte no Wi-Fi da loja para bater o ponto.
        </p>
      )}

      {passo === 'quem' && (
        <EscolherPessoa
          funcionarios={(contexto.funcionarios ?? []).map((f) => ({ ...f, pode_abrir_loja: false }))}
          busca={busca}
          onBusca={setBusca}
          onEscolher={(f) => escolher({ id: f.id, nome: f.nome })}
          onVoltar={voltar}
        />
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
            onConfirmar={confirmarBatida}
            confirmando={enviando}
          />

          <Button variant="ghost" className="h-12" onClick={voltar}>
            Cancelar
          </Button>
        </main>
      )}

      {passo === 'liberar' && pessoa && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-5 text-center">
          <Smartphone className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-xl font-heading">{pessoa.nome}</p>
            {status === 'revogado' ? (
              <p className="text-muted-foreground mt-2 max-w-xs">
                Este celular foi bloqueado. Fale com o gestor antes de tentar de novo.
              </p>
            ) : status === 'pendente' ? (
              <p className="text-muted-foreground mt-2 max-w-xs">
                Seu celular já foi registrado e está esperando o gestor liberar.
              </p>
            ) : (
              <p className="text-muted-foreground mt-2 max-w-xs">
                Este celular ainda não é o seu aparelho liberado. Confirme com seu PIN que ele é
                seu — depois o gestor libera.
              </p>
            )}
          </div>

          {status !== 'revogado' && (
            <>
              <Input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Apelido do aparelho (ex.: meu Moto G)"
                className="h-12 max-w-xs"
              />
              <TecladoPin
                valor={pin}
                onChange={setPin}
                onConfirmar={confirmarLiberacao}
                confirmando={enviando}
              />
            </>
          )}

          {enviando && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

          <Button variant="ghost" className="h-12" onClick={voltar}>
            Voltar
          </Button>
        </main>
      )}
    </div>
  );
};

export default PontoQr;
