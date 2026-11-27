import { useState } from 'react';
import { CheckCircle2, Footprints, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CORES_DE_CHINELO, NUMEROS_DE_CHINELO } from '@/components/ponto/PedirChinelo';

const OUTRO = '__outro__';
const CAMPO = 'h-14 rounded-2xl border-slate-300 bg-white px-5 text-base text-slate-900 placeholder:text-slate-400';

const Opcao = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-12 rounded-2xl border px-4 text-base font-medium transition active:scale-[0.98]',
      ativo ? 'border-[#1573D6] bg-[#1573D6] text-white' : 'border-slate-300 bg-white text-slate-800'
    )}
  >
    {children}
  </button>
);

/**
 * Página aberta pelo QR do balcão: o cliente pede o chinelo que não tem na loja.
 * O pedido entra como "a confirmar" e um funcionário aceita no quiosque.
 */
const PedidoChinelo = () => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [numero, setNumero] = useState('');
  const [numeroLivre, setNumeroLivre] = useState('');
  const [cor, setCor] = useState('');
  const [corLivre, setCorLivre] = useState('');
  const [observacao, setObservacao] = useState('');
  const [site, setSite] = useState(''); // armadilha para robô: pessoa nunca vê nem preenche
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const numeroFinal = numero === OUTRO ? numeroLivre.trim() : numero;
  const corFinal = cor === OUTRO ? corLivre.trim() : cor;
  const completo =
    nome.trim().length >= 2 && telefone.replace(/\D/g, '').length >= 8 && numeroFinal !== '' && corFinal !== '';

  const enviar = async () => {
    if (!completo || enviando) return;
    setEnviando(true);
    setErro(null);
    const { data, error } = await supabase.rpc('chinelo_pedido_publico', {
      p_nome: nome.trim(),
      p_telefone: telefone.trim(),
      p_numero: numeroFinal,
      p_cor: corFinal,
      p_observacao: observacao.trim() || undefined,
      p_site: site || undefined,
    });
    setEnviando(false);
    const r = data as unknown as { ok?: boolean; mensagem?: string } | null;
    if (error || !r?.ok) {
      setErro(r?.mensagem ?? 'Não deu para enviar agora. Tente de novo ou fale com um atendente.');
      return;
    }
    setFeito(r.mensagem ?? 'Pedido recebido!');
  };

  if (feito) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-[#2F9E44]" />
        <p className="text-2xl font-semibold text-slate-900">Pedido enviado</p>
        <p className="max-w-sm text-base text-slate-600">{feito}</p>
        <p className="text-sm text-slate-500">Ubadesklimp · Ubatuba</p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-5 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#1573D6]/10">
            <Footprints className="h-7 w-7 text-[#1573D6]" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Peça seu chinelo</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Não achou o número ou a cor? Faça o pedido aqui e avisamos no WhatsApp quando chegar.
          </p>
        </div>

        <div className="space-y-3">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" maxLength={80} className={CAMPO} />
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Seu WhatsApp com DDD"
            inputMode="tel"
            autoComplete="tel"
            maxLength={30}
            className={CAMPO}
          />
        </div>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Número</p>
          <div className="flex flex-wrap gap-2">
            {NUMEROS_DE_CHINELO.map((n) => (
              <Opcao key={n} ativo={numero === n} onClick={() => setNumero(n)}>
                {n}
              </Opcao>
            ))}
            <Opcao ativo={numero === OUTRO} onClick={() => setNumero(OUTRO)}>
              Outro
            </Opcao>
          </div>
          {numero === OUTRO && (
            <Input value={numeroLivre} onChange={(e) => setNumeroLivre(e.target.value)} placeholder="Qual número?" maxLength={30} className={CAMPO} />
          )}
        </section>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Cor</p>
          <div className="flex flex-wrap gap-2">
            {CORES_DE_CHINELO.map((c) => (
              <Opcao key={c} ativo={cor === c} onClick={() => setCor(c)}>
                {c}
              </Opcao>
            ))}
            <Opcao ativo={cor === OUTRO} onClick={() => setCor(OUTRO)}>
              Outra
            </Opcao>
          </div>
          {cor === OUTRO && (
            <Input value={corLivre} onChange={(e) => setCorLivre(e.target.value)} placeholder="Qual cor?" maxLength={40} className={CAMPO} />
          )}
        </section>

        <Input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Modelo ou observação (opcional)"
          maxLength={200}
          className={CAMPO}
        />

        {/* Armadilha de robô: fora da tela, sem foco, sem preenchimento automático. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
          <input type="text" name="site" tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
        </div>

        {erro && <p className="text-center text-sm font-medium text-[#C0392B]">{erro}</p>}

        <button
          type="button"
          disabled={!completo || enviando}
          onClick={enviar}
          className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#1573D6] text-lg font-semibold text-white transition active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
        >
          {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
          Enviar pedido
        </button>
      </div>
    </main>
  );
};

export default PedidoChinelo;
