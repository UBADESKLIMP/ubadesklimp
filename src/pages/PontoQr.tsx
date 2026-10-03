import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QrCode, Wifi, WifiOff, Clock, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Teclado from '@/components/ponto/Teclado';
import Aviso from '@/components/ponto/Aviso';
import { usePontoInstalavel } from '@/hooks/usePontoInstalavel';
import { usePontoQr, type StatusDispositivo } from '@/hooks/usePontoQr';
import { TIPO_LABEL } from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
  codigo?: string;
}

/**
 * Tela do QR impresso (PRD 4.2). Vive no celular da pessoa, aberta pela câmera
 * nativa. Igual ao balcão, só o PIN: um papel colado na parede não deve virar
 * a lista de quem trabalha na loja.
 */
const PontoQr = () => {
  usePontoInstalavel();
  const { token } = useParams<{ token: string }>();
  const { contexto, carregando, verificarDispositivo, liberarDispositivo, baterPorPin } =
    usePontoQr(token);

  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);
  const [liberar, setLiberar] = useState<{ nome: string; status: StatusDispositivo } | null>(null);
  const [apelido, setApelido] = useState('');

  const voltar = () => {
    setPin('');
    setAviso(null);
    setLiberar(null);
    setApelido('');
  };

  useEffect(() => {
    document.title = 'Bater ponto · Ubadesklimp';
  }, []);

  // Mesma regra do balcão: Esc desiste e volta pro começo.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        voltar();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  const confirmar = async () => {
    if (pin.length !== 4) return;
    setEnviando(true);

    // Antes de tentar bater, conferir o aparelho: a mensagem fica mais útil
    // ("seu celular ainda não foi liberado") do que uma recusa seca.
    const d = await verificarDispositivo(pin);
    if (!d.ok) {
      setEnviando(false);
      setPin('');
      setAviso({ ok: false, mensagem: d.mensagem });
      return;
    }
    if (d.status !== 'aprovado') {
      setEnviando(false);
      setLiberar({ nome: d.nome ?? '', status: (d.status ?? 'novo') as StatusDispositivo });
      return;
    }

    const r = await baterPorPin(pin);
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
      nome: r.nome,
      destaque: hora,
      detalhe: r.tipo ? TIPO_LABEL[r.tipo] : 'Registrado',
      mensagem: r.ignorada ? r.mensagem : undefined,
      codigo: r.ignorada ? undefined : r.codigo,
    });
  };

  const pedirLiberacao = async () => {
    if (pin.length !== 4) return;
    setEnviando(true);
    const r = await liberarDispositivo(pin, apelido.trim() || undefined);
    setEnviando(false);
    setPin('');

    if (!r.ok) {
      setAviso({ ok: false, mensagem: r.mensagem });
      return;
    }
    setAviso({ ok: true, destaque: 'Pedido enviado', mensagem: r.mensagem });
    setLiberar(null);
  };

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F3]">
        <Clock className="h-8 w-8 animate-pulse text-[#55605F]" />
      </div>
    );
  }

  if (!contexto?.ok) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F6F3] text-[#141B1E] p-6 gap-4 text-center">
        <QrCode className="h-12 w-12 text-[#55605F]" />
        <h1 className="text-2xl font-heading">Este QR não vale mais</h1>
        <p className="text-[#55605F] max-w-xs">
          O código foi trocado. Peça o novo para o gestor e cole no lugar deste.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F3] text-[#141B1E] flex flex-col">
      {aviso && <Aviso {...aviso} onFim={voltar} />}

      <header className="flex items-center justify-between px-5 py-3.5">
        <span className="text-xs text-[#8A9290] flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          {contexto.local}
        </span>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs',
            contexto.rede_ok ? 'text-[#2F9E44]' : 'text-[#C0392B]'
          )}
        >
          {contexto.rede_ok ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {contexto.rede_ok ? 'rede da loja' : 'fora da rede'}
        </span>
      </header>

      {!contexto.rede_ok && (
        <p className="bg-[#C0392B]/10 text-[#C0392B] text-sm px-5 py-3 text-center">
          Conecte no Wi-Fi da loja para bater o ponto.
        </p>
      )}

      {liberar ? (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6 text-center">
          <div className="h-12 w-12 rounded-full bg-[#B8860B]/10 flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-[#B8860B]" />
          </div>
          <div>
            <p className="text-xl font-heading">{liberar.nome}</p>
            <p className="text-sm text-[#55605F] mt-1.5 max-w-xs">
              {liberar.status === 'revogado'
                ? 'Este celular foi bloqueado. Fale com o gestor antes de tentar de novo.'
                : liberar.status === 'pendente'
                  ? 'Seu celular já está esperando o gestor liberar.'
                  : 'Este celular ainda não é o seu aparelho liberado. Confirme com seu PIN que ele é seu — depois o gestor libera.'}
            </p>
          </div>

          {liberar.status !== 'revogado' && (
            <>
              <Input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Apelido do aparelho (ex.: meu Moto G)"
                className="h-12 max-w-xs bg-white border-[#DCDFD8]"
              />
              <Teclado
                valor={pin}
                onChange={setPin}
                onConfirmar={pedirLiberacao}
                confirmando={enviando}
                tom="loja"
              />
            </>
          )}

          <button
            type="button"
            onClick={voltar}
            className="text-sm text-[#55605F] hover:text-[#141B1E] py-2 px-4"
          >
            Voltar
          </button>
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-6 gap-7">
          <p className="text-sm text-[#55605F]">Digite seu PIN para bater o ponto</p>
          <Teclado valor={pin} onChange={setPin} onConfirmar={confirmar} confirmando={enviando} />
        </main>
      )}
    </div>
  );
};

export default PontoQr;
