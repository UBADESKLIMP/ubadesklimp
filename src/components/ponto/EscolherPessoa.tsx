import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FuncionarioDoQuiosque } from '@/hooks/usePontoQuiosque';

interface Props {
  funcionarios: FuncionarioDoQuiosque[];
  busca: string;
  onBusca: (v: string) => void;
  onEscolher: (f: FuncionarioDoQuiosque) => void;
  onVoltar: () => void;
  vazio?: string;
}

const EscolherPessoa = ({ funcionarios, busca, onBusca, onEscolher, onVoltar, vazio }: Props) => {
  const filtrados = funcionarios.filter((f) =>
    f.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <main className="flex-1 flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-12 w-12" onClick={onVoltar}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Input
          autoFocus
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar seu nome"
          className="h-12 text-base"
        />
      </div>

      <div className="flex-1 overflow-y-auto grid gap-2 sm:grid-cols-2 content-start">
        {filtrados.length === 0 && (
          <p className="text-muted-foreground p-4">{vazio ?? 'Nenhum nome encontrado.'}</p>
        )}
        {filtrados.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onEscolher(f)}
            className="h-16 rounded-xl border bg-card px-4 text-left text-lg hover:bg-accent active:scale-[0.99] transition"
          >
            {f.nome}
          </button>
        ))}
      </div>
    </main>
  );
};

export default EscolherPessoa;
