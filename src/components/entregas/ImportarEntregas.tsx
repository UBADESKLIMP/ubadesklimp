import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Check, AlertTriangle, MapPinPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeText } from '@/lib/utils';
import ImportarPedidosErp from './ImportarPedidosErp';
import NovaEntregaAvulsa from './NovaEntregaAvulsa';
import {
  emReais,
  type BairroDeEntrega,
  type ResultadoImportacao,
  type ResultadoRpc,
} from '@/hooks/useEntregas';

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';
const CHAVE_MAPA = 'ubadesklimp.entregas.colunas';

/**
 * O relatório do ERP nunca foi exportado — o levantamento travou antes. Então
 * em vez de chutar nomes de coluna e quebrar na primeira atualização da
 * Leantech, a tela pergunta. Ele mapeia uma vez e fica guardado.
 */
interface Campo {
  chave: string;
  rotulo: string;
  obrigatorio?: boolean;
  /** Palpites de nome de coluna, já sem acento e em minúscula. */
  pistas: string[];
}

const CAMPOS: Campo[] = [
  { chave: 'documento_numero', rotulo: 'Número do documento', obrigatorio: true, pistas: ['documento', 'numero', 'num', 'pedido', 'nota'] },
  { chave: 'cliente_nome', rotulo: 'Cliente', obrigatorio: true, pistas: ['cliente', 'nome', 'razao', 'destinatario'] },
  { chave: 'documento_tipo', rotulo: 'Tipo do documento', pistas: ['tipo', 'especie', 'serie'] },
  { chave: 'documento_data', rotulo: 'Data do pedido', pistas: ['data', 'emissao'] },
  { chave: 'cliente_codigo', rotulo: 'Código do cliente', pistas: ['codigo', 'cod cliente', 'cod'] },
  { chave: 'cliente_telefone', rotulo: 'Telefone', pistas: ['telefone', 'fone', 'celular', 'whats'] },
  { chave: 'endereco_logradouro', rotulo: 'Rua', pistas: ['endereco', 'logradouro', 'rua', 'avenida'] },
  { chave: 'endereco_numero', rotulo: 'Número da casa', pistas: ['numero end', 'nro', 'num end'] },
  { chave: 'bairro', rotulo: 'Bairro', pistas: ['bairro'] },
  { chave: 'cidade', rotulo: 'Cidade', pistas: ['cidade', 'municipio'] },
  { chave: 'cep', rotulo: 'CEP', pistas: ['cep'] },
  { chave: 'entregar_em', rotulo: 'Entregar em (endereço avulso)', pistas: ['entregar', 'entrega em', 'obs', 'observacao'] },
  { chave: 'valor', rotulo: 'Valor', pistas: ['valor', 'total', 'liquido'] },
];

const NAO_TEM = '__nao_tem__';

/** Palpite por nome aproximado. Ele corrige o que estiver errado. */
const adivinhar = (cabecalhos: string[]): Record<string, string> => {
  const mapa: Record<string, string> = {};
  const usados = new Set<string>();

  CAMPOS.forEach((campo) => {
    const achou = cabecalhos.find((cab) => {
      if (usados.has(cab)) return false;
      const limpo = normalizeText(cab);
      return campo.pistas.some((pista) => limpo.includes(pista));
    });
    if (achou) {
      mapa[campo.chave] = achou;
      usados.add(achou);
    } else {
      mapa[campo.chave] = NAO_TEM;
    }
  });
  return mapa;
};

const comoTexto = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  return String(v).trim() || null;
};

/** "1.234,50" e 1234.5 chegam do Excel; os dois têm que virar 1234.5. */
const comoNumero = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return String(v);
  const limpo = String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? String(n) : null;
};

/** O Excel guarda data como número de série; o banco quer ISO. */
const comoData = (v: unknown): string | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const texto = String(v).trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(texto) ? texto.slice(0, 10) : null;
};

interface Props {
  onImportar: (linhas: unknown[]) => Promise<ResultadoImportacao>;
  onDepoisDeImportar: () => void;
  bairrosConhecidos: BairroDeEntrega[];
  onAdicionarBairro: (nome: string) => Promise<ResultadoRpc>;
}

const ImportarPlanilha = ({
  onImportar,
  onDepoisDeImportar,
  bairrosConhecidos,
  onAdicionarBairro,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [cabecalhos, setCabecalhos] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<unknown[][]>([]);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [bairrosPendentes, setBairrosPendentes] = useState<string[]>([]);

  const escolherArquivo = async (arquivo: File) => {
    setErro(null);
    setResultado(null);
    try {
      const buffer = await arquivo.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const tudo = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      const cabecalho = (tudo[0] ?? []).map((c, i) => comoTexto(c) ?? `Coluna ${i + 1}`);
      const corpo = tudo.slice(1).filter((l) => l.some((c) => comoTexto(c) !== null));

      if (cabecalho.length === 0 || corpo.length === 0) {
        setErro('A planilha está vazia, ou a primeira linha não é o cabeçalho.');
        return;
      }

      setNomeArquivo(arquivo.name);
      setCabecalhos(cabecalho);
      setLinhas(corpo);

      // Reusa o mapeamento da última vez se as colunas forem as mesmas.
      let guardado: Record<string, string> | null = null;
      try {
        const bruto = localStorage.getItem(CHAVE_MAPA);
        if (bruto) guardado = JSON.parse(bruto) as Record<string, string>;
      } catch {
        guardado = null;
      }
      const serve =
        guardado &&
        Object.values(guardado).every((col) => col === NAO_TEM || cabecalho.includes(col));
      setMapa(serve && guardado ? guardado : adivinhar(cabecalho));
    } catch {
      setErro('Não foi possível ler a planilha. Confira se é um arquivo .xlsx do ERP.');
    }
  };

  const valorDe = (linha: unknown[], chave: string) => {
    const coluna = mapa[chave];
    if (!coluna || coluna === NAO_TEM) return null;
    const i = cabecalhos.indexOf(coluna);
    return i < 0 ? null : linha[i];
  };

  const montarLinhas = () =>
    linhas
      .map((linha) => ({
        documento_tipo: comoTexto(valorDe(linha, 'documento_tipo')) ?? 'PEDIDO',
        documento_numero: comoTexto(valorDe(linha, 'documento_numero')),
        documento_data: comoData(valorDe(linha, 'documento_data')),
        cliente_codigo: comoTexto(valorDe(linha, 'cliente_codigo')),
        cliente_nome: comoTexto(valorDe(linha, 'cliente_nome')),
        cliente_telefone: comoTexto(valorDe(linha, 'cliente_telefone')),
        endereco_logradouro: comoTexto(valorDe(linha, 'endereco_logradouro')),
        endereco_numero: comoTexto(valorDe(linha, 'endereco_numero')),
        bairro: comoTexto(valorDe(linha, 'bairro')),
        cidade: comoTexto(valorDe(linha, 'cidade')),
        cep: comoTexto(valorDe(linha, 'cep')),
        entregar_em: comoTexto(valorDe(linha, 'entregar_em')),
        valor: comoNumero(valorDe(linha, 'valor')),
        itens: [],
      }))
      // Linha sem documento ou sem cliente não é entrega: é rodapé de total,
      // subtotal de página, ou linha em branco no meio do relatório.
      .filter((l) => l.documento_numero && l.cliente_nome);

  const prontas = cabecalhos.length > 0 ? montarLinhas() : [];
  const faltaObrigatorio = CAMPOS.filter(
    (c) => c.obrigatorio && (!mapa[c.chave] || mapa[c.chave] === NAO_TEM)
  );

  const bairrosNaoCadastrados = (() => {
    const conhecidos = new Set(bairrosConhecidos.map((b) => normalizeText(b.nome)));
    const novos = new Set<string>();
    prontas.forEach((l) => {
      if (l.bairro && !conhecidos.has(normalizeText(l.bairro))) novos.add(l.bairro);
    });
    return [...novos];
  })();

  const importar = async () => {
    setEnviando(true);
    setErro(null);
    const r = await onImportar(prontas);
    setEnviando(false);
    setResultado(r);
    if (r.ok) {
      try {
        localStorage.setItem(CHAVE_MAPA, JSON.stringify(mapa));
      } catch {
        // Navegador sem storage não impede importar — só não guarda o mapa.
      }
      setBairrosPendentes(r.bairros_novos ?? []);
      onDepoisDeImportar();
    }
  };

  const cadastrar = async (nome: string) => {
    const r = await onAdicionarBairro(nome);
    if (r.ok) setBairrosPendentes((atual) => atual.filter((b) => b !== nome));
    else setErro(r.mensagem ?? null);
  };

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Importar Pedidos Pendentes</CardTitle>
          <p className="text-xs text-blue-300/50">
            No ERP: Contas Receber → Relatórios → Sobre Pedidos → Pedidos Pendentes, marcar
            "Somente Pendentes" e exportar em Excel. Subir o mesmo arquivo duas vezes não duplica
            nada, e pedido já entregue continua entregue.
          </p>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) escolherArquivo(arquivo);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => inputRef.current?.click()}
              className="h-11 bg-blue-600 text-white hover:bg-blue-500"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {nomeArquivo ? 'Escolher outra planilha' : 'Escolher a planilha'}
            </Button>
            {nomeArquivo && (
              <span className="text-xs text-blue-300/60">
                {nomeArquivo} · <span className="font-mono tabular-nums">{linhas.length}</span>{' '}
                linhas lidas
              </span>
            )}
          </div>
          {erro && <p className="mt-3 text-sm text-[#ff8a7a]">{erro}</p>}
        </CardContent>
      </Card>

      {cabecalhos.length > 0 && (
        <Card className={CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Qual coluna é o quê</CardTitle>
            <p className="text-xs text-blue-300/50">
              Chutei pelo nome do cabeçalho. Corrija o que errei — fica guardado para as próximas
              vezes, então é trabalho de uma vez só.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((campo) => (
              <div key={campo.chave}>
                <label className="text-xs text-blue-300/70">
                  {campo.rotulo}
                  {campo.obrigatorio && <span className="text-[#C0392B]"> *</span>}
                </label>
                <Select
                  value={mapa[campo.chave] ?? NAO_TEM}
                  onValueChange={(v) => setMapa((atual) => ({ ...atual, [campo.chave]: v }))}
                >
                  <SelectTrigger className="mt-1 h-11 border-blue-500/20 bg-[#0c0c14] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-blue-500/20 bg-[#0f0f18] text-white">
                    <SelectItem value={NAO_TEM}>— não tem na planilha —</SelectItem>
                    {cabecalhos.map((cab) => (
                      <SelectItem key={cab} value={cab}>
                        {cab}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {cabecalhos.length > 0 && (
        <Card className={CARD}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Confira antes de gravar</CardTitle>
            <p className="text-xs text-blue-300/50">
              Nada vai para o banco até você confirmar. As três primeiras, já interpretadas:
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {prontas.slice(0, 3).map((l, i) => (
              <div key={i} className="rounded-lg border border-blue-500/10 px-3 py-2 text-xs">
                <p className="font-medium text-white">{l.cliente_nome}</p>
                <p className="mt-1 text-blue-300/55">
                  <span className="font-mono tabular-nums">
                    {l.documento_tipo} {l.documento_numero}
                  </span>
                  {' · '}
                  <span className="font-mono tabular-nums">
                    {emReais(l.valor == null ? null : Number(l.valor))}
                  </span>
                  {l.bairro && ` · ${l.bairro}`}
                </p>
                <p className="mt-0.5 text-blue-300/70">
                  {l.entregar_em ||
                    [l.endereco_logradouro, l.endereco_numero].filter(Boolean).join(', ') ||
                    'Sem endereço'}
                </p>
              </div>
            ))}

            {faltaObrigatorio.length > 0 && (
              <p className="text-sm text-[#ff8a7a]">
                Diga qual coluna é{' '}
                {faltaObrigatorio.map((c) => c.rotulo.toLowerCase()).join(' e ')} antes de importar.
              </p>
            )}

            {prontas.length === 0 && faltaObrigatorio.length === 0 && (
              <p className="text-sm text-[#ff8a7a]">
                Nenhuma linha tem documento e cliente ao mesmo tempo. Confira o mapeamento.
              </p>
            )}

            {bairrosNaoCadastrados.length > 0 && (
              <p className="text-xs text-[#f0b429]">
                {bairrosNaoCadastrados.length === 1
                  ? '1 bairro da planilha não está cadastrado'
                  : `${bairrosNaoCadastrados.length} bairros da planilha não estão cadastrados`}{' '}
                ({bairrosNaoCadastrados.slice(0, 4).join(', ')}
                {bairrosNaoCadastrados.length > 4 && '...'}). Essas entregas entram no fim da rota
                até você cadastrar o bairro.
              </p>
            )}

            <Button
              onClick={importar}
              disabled={enviando || prontas.length === 0 || faltaObrigatorio.length > 0}
              className="h-12 w-full bg-blue-600 text-white hover:bg-blue-500"
            >
              {enviando
                ? 'Importando...'
                : `Importar ${prontas.length} ${prontas.length === 1 ? 'entrega' : 'entregas'}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {resultado && (
        <Card className={`${CARD} ${resultado.ok ? 'border-[#2F9E44]/40' : 'border-[#C0392B]/40'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-white">
              {resultado.ok ? (
                <Check className="h-4 w-4 text-[#2F9E44]" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[#C0392B]" />
              )}
              {resultado.ok ? 'Importado' : 'Não deu para importar'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {resultado.ok ? (
              <p className="text-blue-300/70">
                <span className="font-mono tabular-nums text-[#2F9E44]">
                  {resultado.criadas ?? 0}
                </span>{' '}
                novas ·{' '}
                <span className="font-mono tabular-nums">{resultado.atualizadas ?? 0}</span>{' '}
                atualizadas ·{' '}
                <span className="font-mono tabular-nums">{resultado.ignoradas ?? 0}</span> já
                entregues, que não voltaram para a fila
              </p>
            ) : (
              <p className="text-[#ff8a7a]">{resultado.mensagem}</p>
            )}

            {bairrosPendentes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[#f0b429]">
                  Bairro que a planilha trouxe e não existe no cadastro. Enquanto não cadastrar,
                  essas entregas vão para o fim da rota — não somem, mas saem fora de ordem.
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

/**
 * A tela da aba Importar: em cima o pedido que o ERP imprime (PDF ou planilha,
 * um por cliente, com itens); embaixo, recolhido, o relatório em planilha com
 * várias linhas, que não traz itens.
 */
const ImportarEntregas = (props: Props) => (
  <div className="space-y-6">
    <ImportarPedidosErp {...props} />
    <details className="group">
      <summary className="cursor-pointer text-sm text-blue-300/70 hover:text-white">
        Entrega avulsa, que não passou pelo ERP
      </summary>
      <div className="mt-4">
        <NovaEntregaAvulsa
          onImportar={props.onImportar}
          onDepoisDeImportar={props.onDepoisDeImportar}
          bairrosConhecidos={props.bairrosConhecidos}
        />
      </div>
    </details>
    <details className="group">
      <summary className="cursor-pointer text-sm text-blue-300/70 hover:text-white">
        Importar um relatório do ERP com várias linhas (planilha, sem itens)
      </summary>
      <div className="mt-4">
        <ImportarPlanilha {...props} />
      </div>
    </details>
  </div>
);

export default ImportarEntregas;
