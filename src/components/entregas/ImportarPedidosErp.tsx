import { useRef, useState } from 'react';
import { AlertTriangle, Check, FileText, MapPinPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { normalizeText } from '@/lib/utils';
import { linhasDoArquivo } from '@/lib/lerArquivoPedido';
import { lerPedidosDeLinhas, type PedidoLido } from '@/lib/pedidoErp';
import {
  emReais,
  type BairroDeEntrega,
  type ResultadoImportacao,
  type ResultadoRpc,
} from '@/hooks/useEntregas';

interface Props {
  onImportar: (linhas: unknown[]) => Promise<ResultadoImportacao>;
  onDepoisDeImportar: () => void;
  bairrosConhecidos: BairroDeEntrega[];
  onAdicionarBairro: (nome: string) => Promise<ResultadoRpc>;
}

interface ArquivoLido {
  nome: string;
  pedidos: PedidoLido[];
  erro: string | null;
}

/**
 * Importar os pedidos que o ERP imprime: um PDF ou planilha por pedido, quantos
 * quiser de uma vez (a pasta do Nextcloud). Mostra o que entendeu antes de
 * gravar, e traz os itens, que alimentam a "Carga do dia" do entregador.
 */
const ImportarPedidosErp = ({ onImportar, onDepoisDeImportar, bairrosConhecidos, onAdicionarBairro }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<ArquivoLido[]>([]);
  const [lendo, setLendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [bairrosPendentes, setBairrosPendentes] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const nomesDeBairros = bairrosConhecidos.map((b) => b.nome);

  const ler = async (lista: File[]) => {
    if (lista.length === 0) return;
    setLendo(true);
    setErro(null);
    setResultado(null);
    const lidos: ArquivoLido[] = [];
    for (const arquivo of lista) {
      try {
        const linhas = await linhasDoArquivo(arquivo);
        const pedidos = lerPedidosDeLinhas(linhas, nomesDeBairros);
        lidos.push({
          nome: arquivo.name,
          pedidos,
          erro: pedidos.length === 0 ? 'Não reconheci como pedido do ERP (não achei o número do pedido).' : null,
        });
      } catch (e) {
        lidos.push({ nome: arquivo.name, pedidos: [], erro: e instanceof Error ? e.message : 'Não consegui ler este arquivo.' });
      }
    }
    setArquivos((atuais) => [...atuais, ...lidos]);
    setLendo(false);
  };

  // O mesmo pedido em dois arquivos (ex.: PDF e planilha) entra uma vez só.
  const todos = (() => {
    const vistos = new Set<string>();
    const unicos: PedidoLido[] = [];
    arquivos.forEach((a) =>
      a.pedidos.forEach((p) => {
        const chave = `${p.documento_tipo}|${p.documento_numero}`;
        if (!vistos.has(chave)) {
          vistos.add(chave);
          unicos.push(p);
        }
      })
    );
    return unicos;
  })();

  const bairrosNovos = (() => {
    const conhecidos = new Set(nomesDeBairros.map(normalizeText));
    const novos = new Set<string>();
    todos.forEach((p) => {
      if (p.bairro && !conhecidos.has(normalizeText(p.bairro))) novos.add(p.bairro);
    });
    return [...novos];
  })();

  const importar = async () => {
    setEnviando(true);
    setErro(null);
    const linhas = todos.map((p) => ({
      documento_tipo: p.documento_tipo,
      documento_numero: p.documento_numero,
      documento_data: p.documento_data,
      cliente_codigo: p.cliente_codigo,
      cliente_nome: p.cliente_nome,
      cliente_telefone: p.cliente_telefone,
      endereco_logradouro: p.endereco_logradouro,
      endereco_numero: p.endereco_numero,
      bairro: p.bairro,
      cidade: p.cidade,
      cep: p.cep,
      entregar_em: p.entregar_em,
      valor: p.valor == null ? null : String(p.valor),
      itens: p.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade })),
    }));
    const r = await onImportar(linhas);
    setEnviando(false);
    setResultado(r);
    if (r.ok) {
      setBairrosPendentes(r.bairros_novos ?? []);
      setArquivos([]);
      onDepoisDeImportar();
    }
  };

  const cadastrar = async (nome: string) => {
    const r = await onAdicionarBairro(nome);
    if (r.ok) setBairrosPendentes((atual) => atual.filter((b) => b !== nome));
    else setErro(r.mensagem ?? null);
  };

  const CARD = 'bg-[#12121a] border-blue-500/20 text-white';

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Importar pedidos do ERP</CardTitle>
          <p className="text-xs text-blue-300/50">
            Solte aqui o pedido (ou orçamento) que o ERP imprime, em <strong>PDF ou planilha</strong>.
            Pode soltar vários de uma vez, um arquivo por pedido. O sistema lê o cliente, o endereço, o
            valor e os <strong>itens</strong>. Subir o mesmo pedido de novo só atualiza, e pedido já
            entregue não volta para a fila.
          </p>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              ler(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastando(false);
              ler(Array.from(e.dataTransfer.files));
            }}
            className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
              arrastando ? 'border-blue-500/70 bg-blue-600/10' : 'border-blue-500/25'
            }`}
          >
            <FileText className="h-8 w-8 text-blue-400" />
            <p className="text-sm text-blue-300/70">Arraste os arquivos para cá, ou</p>
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={lendo}
              className="h-11 bg-blue-600 text-white hover:bg-blue-500"
            >
              {lendo ? 'Lendo...' : 'Escolher arquivos'}
            </Button>
          </div>
          {erro && <p className="mt-3 text-sm text-[#ff8a7a]">{erro}</p>}
        </CardContent>
      </Card>

      {arquivos.length > 0 && (
        <Card className={CARD}>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base text-white">Confira antes de gravar</CardTitle>
              <p className="text-xs text-blue-300/50">Nada vai para o banco até você confirmar.</p>
            </div>
            <button
              type="button"
              onClick={() => setArquivos([])}
              className="inline-flex items-center gap-1 text-xs text-blue-300/70 hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" /> limpar
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            {arquivos.map((a, i) => (
              <div key={`${a.nome}-${i}`} className="space-y-2">
                {a.erro && (
                  <p className="flex items-start gap-2 rounded-lg border border-[#C0392B]/40 px-3 py-2 text-xs text-[#ff8a7a]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{a.nome}</strong>: {a.erro}
                    </span>
                  </p>
                )}
                {a.pedidos.map((p) => (
                  <div key={`${p.documento_tipo}-${p.documento_numero}`} className="rounded-lg border border-blue-500/15 px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-white">{p.cliente_nome}</p>
                      <p className="font-mono tabular-nums text-blue-300">{emReais(p.valor)}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-blue-300/60">
                      <span className="font-mono tabular-nums">
                        {p.documento_tipo} {p.documento_numero}
                      </span>
                      {p.bairro && ` · ${p.bairro}`}
                      {p.cliente_telefone && ` · ${p.cliente_telefone}`}
                    </p>
                    <p className="text-xs text-blue-300/70">
                      {p.entregar_em ||
                        [p.endereco_logradouro, p.endereco_numero].filter(Boolean).join(', ') ||
                        'Sem endereço'}
                    </p>
                    {p.itens.length > 0 && (
                      <details className="mt-1.5 text-xs text-blue-300/70">
                        <summary className="cursor-pointer">
                          {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-4">
                          {p.itens.map((it, k) => (
                            <li key={k}>
                              <span className="font-mono tabular-nums">{it.quantidade}</span>
                              {it.unidade ? ` ${it.unidade}` : ''} {it.descricao}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {p.avisos.map((av) => (
                      <p key={av} className="mt-1 text-xs text-[#f0b429]">
                        {av}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            ))}

            {bairrosNovos.length > 0 && (
              <p className="text-xs text-[#f0b429]">
                {bairrosNovos.length === 1 ? '1 bairro' : `${bairrosNovos.length} bairros`} do(s) pedido(s) não
                {bairrosNovos.length === 1 ? ' está cadastrado' : ' estão cadastrados'} (
                {bairrosNovos.slice(0, 4).join(', ')}). Essas entregas entram no fim da rota até você cadastrar.
              </p>
            )}

            <Button
              onClick={importar}
              disabled={enviando || todos.length === 0}
              className="h-12 w-full bg-blue-600 text-white hover:bg-blue-500"
            >
              {enviando
                ? 'Importando...'
                : todos.length === 0
                  ? 'Nenhum pedido reconhecido'
                  : `Importar ${todos.length} ${todos.length === 1 ? 'pedido' : 'pedidos'}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card className={`${CARD} ${resultado.ok ? 'border-[#2F9E44]/40' : 'border-[#C0392B]/40'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              {resultado.ok ? <Check className="h-4 w-4 text-[#2F9E44]" /> : <AlertTriangle className="h-4 w-4 text-[#C0392B]" />}
              {resultado.ok ? 'Importado' : 'Não deu para importar'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resultado.ok ? (
              <p className="text-blue-300/70">
                <span className="font-mono tabular-nums text-[#2F9E44]">{resultado.criadas ?? 0}</span> novos ·{' '}
                <span className="font-mono tabular-nums">{resultado.atualizadas ?? 0}</span> atualizados ·{' '}
                <span className="font-mono tabular-nums">{resultado.ignoradas ?? 0}</span> já entregues, que não voltaram
                para a fila. Veja na aba <strong>Fila</strong>.
              </p>
            ) : (
              <p className="text-[#ff8a7a]">{resultado.mensagem}</p>
            )}
            {bairrosPendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[#f0b429]">
                  Bairro que o pedido trouxe e não existe no cadastro. Enquanto não cadastrar, essas entregas vão para o
                  fim da rota.
                </p>
                <div className="flex flex-wrap gap-2">
                  {bairrosPendentes.map((nome) => (
                    <Button
                      key={nome}
                      onClick={() => cadastrar(nome)}
                      variant="outline"
                      className="h-11 border-blue-500/30 bg-[#0c0c14] text-blue-300 hover:bg-blue-600/10"
                    >
                      <MapPinPlus className="mr-2 h-4 w-4" />
                      Cadastrar {nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportarPedidosErp;
