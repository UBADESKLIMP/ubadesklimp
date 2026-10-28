import { useState } from 'react';
import { AlertTriangle, Check, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { BairroDeEntrega, ResultadoImportacao } from '@/hooks/useEntregas';

interface Props {
  onImportar: (linhas: unknown[]) => Promise<ResultadoImportacao>;
  onDepoisDeImportar: () => void;
  bairrosConhecidos: BairroDeEntrega[];
}

interface ItemDigitado {
  chave: number;
  quantidade: string;
  descricao: string;
}

const CARD = 'bg-[#12121a] border-blue-500/20 text-white';
const CAMPO = 'h-11 border-blue-500/20 bg-[#0c0c14] text-white placeholder:text-blue-300/40';

/** Número que o sistema inventa para a entrega que não veio do ERP: AV-281026-1530-7. */
const numeroAvulso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `AV-${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}-${p(d.getHours())}${p(
    d.getMinutes()
  )}-${Math.floor(Math.random() * 90 + 10)}`;
};

const comoNumero = (v: string): string | null => {
  const limpo = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return limpo && Number.isFinite(n) ? String(n) : null;
};

/**
 * Entrega que não passou pelo ERP: pedido de balcão ou de WhatsApp. Cliente e
 * endereço são obrigatórios (sem eles o entregador não tem para onde ir); o
 * resto ajuda, mas não trava.
 */
const NovaEntregaAvulsa = ({ onImportar, onDepoisDeImportar, bairrosConhecidos }: Props) => {
  const [cliente, setCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [valor, setValor] = useState('');
  const [itens, setItens] = useState<ItemDigitado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);

  const faltando: string[] = [];
  if (!cliente.trim()) faltando.push('o cliente');
  if (!endereco.trim()) faltando.push('o endereço');

  const bairroNovo =
    bairro.trim() !== '' &&
    !bairrosConhecidos.some((b) => b.nome.trim().toLowerCase() === bairro.trim().toLowerCase());

  const limpar = () => {
    setCliente('');
    setTelefone('');
    setEndereco('');
    setBairro('');
    setValor('');
    setItens([]);
  };

  const salvar = async () => {
    setEnviando(true);
    setResultado(null);
    const r = await onImportar([
      {
        documento_tipo: 'AVULSA',
        documento_numero: numeroAvulso(),
        documento_data: new Date().toISOString().slice(0, 10),
        cliente_codigo: null,
        cliente_nome: cliente.trim(),
        cliente_telefone: telefone.trim() || null,
        endereco_logradouro: endereco.trim(),
        endereco_numero: null,
        bairro: bairro.trim() || null,
        cidade: null,
        cep: null,
        entregar_em: null,
        valor: comoNumero(valor),
        itens: itens
          .filter((i) => i.descricao.trim())
          .map((i) => ({
            descricao: i.descricao.trim(),
            quantidade: Number(i.quantidade.replace(',', '.')) || 1,
          })),
      },
    ]);
    setEnviando(false);
    setResultado(r);
    if (r.ok) {
      limpar();
      onDepoisDeImportar();
    }
  };

  return (
    <Card className={CARD}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white">Nova entrega avulsa</CardTitle>
        <p className="text-xs text-blue-300/50">
          Para o que não veio do ERP, como pedido de balcão ou de WhatsApp. Ela cai na aba Fila, pronta
          para entrar na rota.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-blue-300/70" htmlFor="av-cliente">
              Cliente <span className="text-[#C0392B]">*</span>
            </label>
            <Input id="av-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" className={`mt-1 ${CAMPO}`} />
          </div>
          <div>
            <label className="text-xs text-blue-300/70" htmlFor="av-telefone">Telefone</label>
            <Input id="av-telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(12) 99999-9999" className={`mt-1 ${CAMPO}`} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-blue-300/70" htmlFor="av-endereco">
              Endereço (rua e número) <span className="text-[#C0392B]">*</span>
            </label>
            <Input id="av-endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua das Palmeiras, 21" className={`mt-1 ${CAMPO}`} />
          </div>
          <div>
            <label className="text-xs text-blue-300/70" htmlFor="av-bairro">Bairro</label>
            <Input
              id="av-bairro"
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              list="av-bairros"
              placeholder="Escolha ou digite"
              className={`mt-1 ${CAMPO}`}
            />
            <datalist id="av-bairros">
              {bairrosConhecidos.map((b) => (
                <option key={b.id} value={b.nome} />
              ))}
            </datalist>
            {bairroNovo && (
              <p className="mt-1 text-xs text-[#f0b429]">
                Bairro novo: a entrega vai para o fim da rota até você cadastrá-lo na aba Bairros.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-blue-300/70" htmlFor="av-valor">Valor (R$)</label>
            <Input id="av-valor" value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={`mt-1 ${CAMPO}`} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-blue-300/70">Itens (opcional, aparecem na "Carga do dia" do entregador)</p>
          {itens.map((item) => (
            <div key={item.chave} className="flex gap-2">
              <Input
                aria-label="Quantidade"
                value={item.quantidade}
                onChange={(e) => setItens((l) => l.map((i) => (i.chave === item.chave ? { ...i, quantidade: e.target.value } : i)))}
                inputMode="decimal"
                className={`w-20 ${CAMPO}`}
              />
              <Input
                aria-label="Descrição do item"
                value={item.descricao}
                onChange={(e) => setItens((l) => l.map((i) => (i.chave === item.chave ? { ...i, descricao: e.target.value } : i)))}
                placeholder="Ex.: Água sanitária 5L"
                className={`flex-1 ${CAMPO}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Tirar item"
                onClick={() => setItens((l) => l.filter((i) => i.chave !== item.chave))}
                className="h-11 w-11 text-blue-300/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setItens((l) => [...l, { chave: Date.now() + l.length, quantidade: '1', descricao: '' }])}
            className="h-10 border-blue-500/30 bg-[#0c0c14] text-blue-300 hover:bg-blue-600/10"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar item
          </Button>
        </div>

        {faltando.length > 0 && (cliente || endereco || telefone || bairro) && (
          <p className="text-xs text-[#f0b429]">Falta preencher {faltando.join(' e ')}.</p>
        )}

        <Button
          onClick={salvar}
          disabled={enviando || faltando.length > 0}
          className="h-12 w-full bg-blue-600 text-white hover:bg-blue-500"
        >
          {enviando ? 'Salvando...' : 'Adicionar à fila de entregas'}
        </Button>

        {resultado && (
          <p className={`flex items-center gap-2 text-sm ${resultado.ok ? 'text-[#2F9E44]' : 'text-[#ff8a7a]'}`}>
            {resultado.ok ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {resultado.ok ? 'Entrega adicionada. Veja na aba Fila.' : resultado.mensagem}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default NovaEntregaAvulsa;
