import { useState } from 'react';
import { QrCode, Loader2, Printer, RefreshCw, Smartphone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { baixarCartazQr } from '@/lib/pontoQrCartaz';
import { TIPO_LABEL } from '@/hooks/usePonto';
import type { LocalQr, DispositivoPendente } from '@/hooks/usePonto';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

interface Props {
  locais: LocalQr[];
  dispositivos: DispositivoPendente[];
  loading: boolean;
  podeGerenciar: boolean;
  criarLocalQr: (nome: string) => Promise<{ ok: boolean; token?: string; mensagem?: string }>;
  rotacionarQr: (localId: string) => Promise<{ ok: boolean; token?: string; mensagem?: string }>;
  decidirDispositivo: (id: string, aprovar: boolean) => Promise<boolean>;
}

const PontoQrLocais = ({
  locais,
  dispositivos,
  loading,
  podeGerenciar,
  criarLocalQr,
  rotacionarQr,
  decidirDispositivo,
}: Props) => {
  const [nome, setNome] = useState('Cozinha');
  const [trabalhando, setTrabalhando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // O token só existe no momento em que é gerado. Imprimir na hora é o
  // caminho normal; quem perder o cartaz rotaciona e imprime de novo.
  const gerarEImprimir = async (local: LocalQr, token: string) => {
    await baixarCartazQr({
      local: local.nome,
      token,
      marcacoes: local.marcacoes.map((m) => TIPO_LABEL[m]),
    });
  };

  const criar = async () => {
    setErro(null);
    setTrabalhando('novo');
    const r = await criarLocalQr(nome.trim() || 'Ponto de QR');
    setTrabalhando(null);
    if (!r.ok || !r.token) {
      setErro(r.mensagem ?? 'Não foi possível criar.');
      return;
    }
    await baixarCartazQr({
      local: nome.trim() || 'Ponto de QR',
      token: r.token,
      marcacoes: ['Saída para a pausa', 'Retorno da pausa'],
    });
    setNome('Cozinha');
  };

  const rotacionar = async (local: LocalQr) => {
    setErro(null);
    setTrabalhando(local.id);
    const r = await rotacionarQr(local.id);
    setTrabalhando(null);
    if (!r.ok || !r.token) {
      setErro(r.mensagem ?? 'Não foi possível rotacionar.');
      return;
    }
    await gerarEImprimir(local, r.token);
  };

  const pendentes = dispositivos.filter((d) => d.status === 'pendente');
  const liberados = dispositivos.filter((d) => d.status === 'aprovado');

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <QrCode className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-white">QR na parede</p>
          </div>
          <p className="text-xs text-blue-300/50 mb-4">
            Cada ponto gera um cartaz pra imprimir e colar. O código sai uma vez só — se perder o
            papel, rotacione e imprima de novo, e o antigo morre na hora.
          </p>

          {podeGerenciar && (
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Onde fica (ex.: Cozinha)"
                className="bg-[#0c0c14] border-blue-500/20 h-11 w-52 text-white placeholder:text-blue-300/40"
              />
              <Button
                className="h-11 bg-blue-600 hover:bg-blue-500"
                disabled={trabalhando === 'novo'}
                onClick={criar}
              >
                {trabalhando === 'novo' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <Printer className="h-4 w-4 mr-2" />
                Criar e imprimir
              </Button>
            </div>
          )}

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          ) : locais.length === 0 ? (
            <p className="text-sm text-blue-300/60 py-2">
              Nenhum ponto de QR ainda. O da cozinha é o caso típico: só pausa de café.
            </p>
          ) : (
            <div className="divide-y divide-blue-500/10">
              {locais.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="text-sm text-white min-w-0 flex-1 truncate">{l.nome}</span>
                  <span className="text-[11px] text-blue-300/50">
                    {l.marcacoes.map((m) => TIPO_LABEL[m]).join(' · ')}
                  </span>
                  {podeGerenciar && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
                      disabled={trabalhando === l.id}
                      onClick={() => rotacionar(l)}
                    >
                      {trabalhando === l.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-2" />
                      )}
                      Novo código e cartaz
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {erro && <p className="text-sm text-[#ff8a7a] mt-3">{erro}</p>}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="h-4 w-4 text-blue-400" />
            <p className="text-sm text-white">Celulares liberados para o QR</p>
          </div>
          <p className="text-xs text-blue-300/50 mb-4">
            Um celular por pessoa. É isso que impede um colega de bater pelo outro usando o próprio
            aparelho. Liberar um novo bloqueia o anterior.
          </p>

          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
          ) : pendentes.length === 0 && liberados.length === 0 ? (
            <p className="text-sm text-blue-300/60 py-2">
              Nenhum celular registrado. Eles aparecem aqui quando a pessoa escaneia o QR pela
              primeira vez.
            </p>
          ) : (
            <div className="divide-y divide-blue-500/10">
              {[...pendentes, ...liberados].map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <span className="text-sm text-white min-w-0 flex-1 truncate">
                    {d.nome}
                    {d.apelido && <span className="text-blue-300/50"> · {d.apelido}</span>}
                  </span>
                  <span className="font-mono text-[11px] text-blue-300/40">
                    {quando(d.created_at)}
                  </span>
                  {d.status === 'pendente' ? (
                    <>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#f0b429]/20 text-[#f0b429]">
                        esperando você
                      </span>
                      <Button
                        size="sm"
                        className="h-9 bg-[#2F9E44] hover:bg-[#2F9E44]/80"
                        onClick={() => decidirDispositivo(d.id, true)}
                      >
                        Liberar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 border-[#C0392B]/40 text-[#ff8a7a] hover:bg-[#C0392B]/10 hover:text-white"
                        onClick={() => decidirDispositivo(d.id, false)}
                      >
                        Recusar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-[#2F9E44] text-white">
                        liberado
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 border-[#C0392B]/40 text-[#ff8a7a] hover:bg-[#C0392B]/10 hover:text-white"
                        onClick={() => decidirDispositivo(d.id, false)}
                      >
                        Bloquear
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PontoQrLocais;
