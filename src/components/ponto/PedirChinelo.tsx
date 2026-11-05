import { useState } from 'react';
import { Footprints, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Teclado from './Teclado';
import type { PedidoDeChinelo, ResultadoChinelo } from '@/hooks/usePontoQuiosque';

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  detalhe?: string;
  mensagem?: string;
}

interface Props {
  anotar: (pin: string, pedido: PedidoDeChinelo) => Promise<ResultadoChinelo>;
  onFim: (a: AvisoAtual) => void;
  onVoltar: () => void;
}

// Numeração da Havaianas: cada número serve a dois pés (35/36, 37/38...).
export const NUMEROS_DE_CHINELO = ['33/34', '35/36', '37/38', '39/40', '41/42', '43/44', '45/46'];
export const CORES_DE_CHINELO = [
  'Preto',
  'Branco',
  'Azul',
  'Azul marinho',
  'Cinza',
  'Rosa',
  'Vermelho',
  'Verde',
  'Amarelo',
  'Bege',
];

const OUTRO = '__outro__';

const CAMPO = 'h-14 rounded-2xl border-white/25 bg-white/10 px-5 text-base text-white placeholder:text-white/50';

const Opcao = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'min-h-12 rounded-2xl border px-4 text-base font-medium transition active:scale-[0.98]',
      ativo ? 'border-white bg-white text-[#0b1020]' : 'border-white/25 bg-white/10 text-white hover:bg-white/15'
    )}
  >
    {children}
  </button>
);

/**
 * "Pedir chinelo": o cliente quer um número e uma cor que não tem na loja. O
 * funcionário anota na hora (em vez de papel) e o escritório encomenda depois.
 * O PIN vem uma vez no começo; quem anotou fica registrado no pedido.
 */
const PedirChinelo = ({ anotar, onFim }: Props) => {
  const [pin, setPin] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [erroPin, setErroPin] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [numero, setNumero] = useState('');
  const [numeroLivre, setNumeroLivre] = useState('');
  const [cor, setCor] = useState('');
  const [corLivre, setCorLivre] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const numeroFinal = numero === OUTRO ? numeroLivre.trim() : numero;
  const corFinal = cor === OUTRO ? corLivre.trim() : cor;
  const telefoneValido = telefone.replace(/\D/g, '').length >= 8;
  const completo = nome.trim().length >= 2 && telefoneValido && numeroFinal !== '' && corFinal !== '';

  const enviar = async () => {
    if (!completo || enviando) return;
    setEnviando(true);
    setErro(null);
    const r = await anotar(pin, {
      nome: nome.trim(),
      telefone: telefone.trim(),
      numero: numeroFinal,
      cor: corFinal,
      observacao: observacao.trim() || undefined,
    });
    setEnviando(false);

    if (!r.ok) {
      // PIN errado volta para o teclado sem perder o que já foi digitado.
      if (r.mensagem?.toLowerCase().includes('pin')) {
        setPin('');
        setAutorizado(false);
        setErroPin(r.mensagem);
        return;
      }
      setErro(r.mensagem ?? 'Não deu para anotar. Tente de novo.');
      return;
    }

    setPin('');
    onFim({
      ok: true,
      destaque: 'Anotado',
      detalhe: `nº ${numeroFinal} · ${corFinal}`,
      mensagem: r.ja_existia ? r.mensagem : `Pedido de ${nome.trim()} guardado. Vamos avisar quando chegar.`,
    });
  };

  if (!autorizado) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-7 p-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Footprints className="h-6 w-6 text-white" />
          </div>
          <p className="text-xl font-heading">Pedir chinelo</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/75">
            Digite seu PIN e anote o que o cliente quer. O escritório faz a encomenda e avisa quando chegar.
          </p>
        </div>

        <Teclado
          valor={pin}
          onChange={(v) => {
            setPin(v);
            setErroPin(null);
          }}
          onConfirmar={() => setAutorizado(true)}
          confirmando={false}
          erro={erroPin}
          plano
        />
        <p className="min-h-5 text-center text-sm font-medium text-[#FFB4AA]">{erroPin}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4 text-white">
      <div className="mx-auto w-full max-w-xl space-y-5">
        <div className="text-center">
          <p className="text-xl font-heading">O que o cliente quer?</p>
          <p className="mt-1 text-sm text-white/70">Havaianas: nome, telefone para avisar, número e cor.</p>
        </div>

        <div className="space-y-3">
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do cliente"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={80}
            className={CAMPO}
          />
          <Input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="Telefone para avisar que chegou"
            inputMode="tel"
            autoComplete="off"
            maxLength={30}
            className={CAMPO}
          />
        </div>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-white/85">Número</p>
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
            <Input
              value={numeroLivre}
              onChange={(e) => setNumeroLivre(e.target.value)}
              placeholder="Qual número?"
              maxLength={30}
              className={CAMPO}
              autoFocus
            />
          )}
        </section>

        <section className="space-y-2">
          <p className="text-sm font-semibold text-white/85">Cor</p>
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
            <Input
              value={corLivre}
              onChange={(e) => setCorLivre(e.target.value)}
              placeholder="Qual cor?"
              maxLength={40}
              className={CAMPO}
              autoFocus
            />
          )}
        </section>

        <Input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Modelo ou observação (opcional)"
          maxLength={200}
          className={CAMPO}
        />

        {erro && <p className="text-center text-sm font-medium text-[#FFB4AA]">{erro}</p>}
      </div>

      <button
        type="button"
        disabled={!completo || enviando}
        onClick={enviar}
        className="sticky bottom-0 mx-auto flex h-16 w-full max-w-xl items-center justify-center gap-3 rounded-2xl bg-white text-lg font-medium text-[#0b1020] transition active:scale-[0.99] disabled:bg-white/10 disabled:text-white/35"
      >
        {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
        Anotar pedido
      </button>
    </main>
  );
};

export default PedirChinelo;
