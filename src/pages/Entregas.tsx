import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Truck } from 'lucide-react';
import Teclado from '@/components/ponto/Teclado';
import Aviso from '@/components/ponto/Aviso';
import MinhaRota from '@/components/entregas/MinhaRota';
import { useEquipeAccess } from '@/hooks/useEquipeAccess';
import { useMinhaRota, type EntregaMotivo } from '@/hooks/useEntregas';

/**
 * De qual loja é este aparelho, em três tentativas: o link que o gestor mandou,
 * a conta de quem está logado, e por último o que o aparelho já tinha guardado.
 * Quem entrega tem conta na equipe (é colaborador, mesma conta do ponto), então
 * o normal é vir do cadastro; o link existe para celular que ninguém logou.
 */
const CHAVE_LOJA = 'ubadesklimp.entregas.loja';

const lojaGuardada = (): string | null => {
  try {
    return localStorage.getItem(CHAVE_LOJA);
  } catch {
    return null;
  }
};

const guardarLoja = (id: string) => {
  try {
    localStorage.setItem(CHAVE_LOJA, id);
  } catch {
    // Navegador sem storage: ele vai precisar do link completo toda vez.
  }
};

interface AvisoAtual {
  ok: boolean;
  nome?: string;
  destaque?: string;
  mensagem?: string;
}

const Entregas = () => {
  const [params] = useSearchParams();
  const daUrl = params.get('loja');
  const { minhaEmpresaId, loading: carregandoConta } = useEquipeAccess();

  const empresaId = useMemo(() => {
    if (daUrl) {
      guardarLoja(daUrl);
      return daUrl;
    }
    if (minhaEmpresaId) {
      guardarLoja(minhaEmpresaId);
      return minhaEmpresaId;
    }
    return lojaGuardada();
  }, [daUrl, minhaEmpresaId]);

  const { rota, carregando, buscarRota, registrar, sair } = useMinhaRota(empresaId);
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);

  // O app do entregador é só esta rota — o resto do site é a loja e não deve
  // virar app de entrega. Mesma decisão do /ponto.
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/entregas.webmanifest';
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const entrar = async () => {
    setErro(null);
    const r = await buscarRota(pin);
    if (!r.ok) {
      setErro(r.mensagem ?? 'PIN não encontrado.');
      setPin('');
      return;
    }
    setPin('');
  };

  const marcar = async (
    entregaId: string,
    tipo: 'entregue' | 'nao_entregue',
    extra?: { motivo?: EntregaMotivo; motivoTexto?: string; quemRecebeu?: string }
  ) => {
    const r = await registrar(entregaId, tipo, extra);
    if (r.ok) {
      setAviso({
        ok: true,
        nome: r.nome,
        destaque: tipo === 'entregue' ? 'Entregue' : 'Voltou',
        mensagem: r.mensagem,
      });
    }
    return r;
  };

  // Enquanto a conta não resolveu não dá pra dizer que o aparelho está sem
  // loja: quem está logado tem empresa, e o aviso errado manda ele pedir um
  // link que ele não precisa.
  if (!empresaId && carregandoConta) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F6F3]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8A9290]" />
      </div>
    );
  }

  if (!empresaId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F3] px-6 text-center">
        <Truck className="h-10 w-10 text-[#8A9290]" />
        <h1 className="mt-4 text-xl font-semibold text-[#141B1E]">Entre com a sua conta</h1>
        <p className="mt-2 max-w-xs text-sm text-[#55605F]">
          Este aparelho ainda não sabe de qual loja é. Entrando com a sua conta da equipe ele
          descobre sozinho, e não pergunta de novo.
        </p>
        <Link
          to="/auth?next=/entregas"
          className="mt-6 flex h-14 w-full max-w-xs items-center justify-center rounded-xl bg-[#141B1E] text-base font-semibold text-white"
        >
          Entrar
        </Link>
        <p className="mt-6 max-w-xs text-xs text-[#8A9290]">
          Sem conta no celular? Peça o link de entregas para o gestor — está no painel, em
          Entregas.
        </p>
      </div>
    );
  }

  if (rota?.ok) {
    return (
      <>
        <MinhaRota
          rota={rota}
          onRegistrar={marcar}
          onSair={() => {
            sair();
            setPin('');
          }}
        />
        {aviso && (
          <Aviso
            ok={aviso.ok}
            nome={aviso.nome}
            destaque={aviso.destaque}
            mensagem={aviso.mensagem}
            onFim={() => setAviso(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F3] px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Truck className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-[#141B1E]">Minhas entregas</h1>
        <p className="mt-1 text-sm text-[#55605F]">Digite seu PIN para ver a rota de hoje.</p>
      </div>

      <Teclado
        valor={pin}
        onChange={setPin}
        onConfirmar={entrar}
        confirmando={carregando}
        tamanho={4}
      />

      {erro && <p className="mt-6 text-center text-sm font-medium text-[#B5362A]">{erro}</p>}
    </div>
  );
};

export default Entregas;
