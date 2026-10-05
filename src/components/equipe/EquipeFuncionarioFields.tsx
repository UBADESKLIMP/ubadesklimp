import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEquipeAccess, type EquipePapel } from '@/hooks/useEquipeAccess';

interface Props {
  userId: string;
}

interface Empresa {
  id: string;
  razao_social: string;
}

interface Escala {
  id: string;
  nome: string;
  empresa_id: string;
  entrada: string;
}

const SEM_VALOR = 'nenhum';

/**
 * Campos do módulo Equipe dentro do cadastro de funcionário que já existe.
 * O caminho do termo de adesão só é lido/gravado aqui porque esta tela é
 * admin-only — gestor usa a view equipe_funcionarios_gestor, que não expõe o path.
 */
const EquipeFuncionarioFields = ({ userId }: Props) => {
  const { toast } = useToast();
  const { isEquipeAdmin } = useEquipeAccess();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [empresaId, setEmpresaId] = useState<string>(SEM_VALOR);
  const [escalaId, setEscalaId] = useState<string>(SEM_VALOR);
  const [papel, setPapel] = useState<string>(SEM_VALOR);
  const [almocoPrevisto, setAlmocoPrevisto] = useState('');
  const [duracaoAlmoco, setDuracaoAlmoco] = useState('120');
  const [termoAssinadoEm, setTermoAssinadoEm] = useState('');
  const [modelo, setModelo] = useState<string>('almoco_2h');
  const [modeloOriginal, setModeloOriginal] = useState<string>('almoco_2h');
  const [cafeAtivo, setCafeAtivo] = useState(false);
  const [foraDoPonto, setForaDoPonto] = useState(false);
  const [podeAbrirLoja, setPodeAbrirLoja] = useState(false);
  const [podeAbrirLojaOriginal, setPodeAbrirLojaOriginal] = useState(false);
  const [podeForaDaRede, setPodeForaDaRede] = useState(false);
  const [podeForaDaRedeOriginal, setPodeForaDaRedeOriginal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const load = async () => {
      setCarregando(true);
      const [
        { data: empresasData },
        { data: escalasData },
        { data: member },
        { data: papelRow },
        { data: aberturaRow },
      ] = await Promise.all([
          supabase.from('empresas').select('id, razao_social').eq('ativo', true).order('razao_social'),
          supabase.from('equipe_escalas').select('id, nome, empresa_id, entrada').eq('ativo', true),
          supabase
            .from('staff_members')
            .select(
              'empresa_id, escala_id, almoco_previsto, duracao_almoco_min, termo_assinado_em, modelo_intervalo, fora_do_ponto'
            )
            .eq('user_id', userId)
            .maybeSingle(),
          supabase.from('equipe_papeis').select('papel').eq('user_id', userId).maybeSingle(),
          supabase.from('ponto_permissoes').select('permissao').eq('user_id', userId),
        ]);

      if (cancelado) return;

      setEmpresas(empresasData ?? []);
      setEscalas(escalasData ?? []);
      setEmpresaId(member?.empresa_id ?? SEM_VALOR);
      setEscalaId(member?.escala_id ?? SEM_VALOR);
      setAlmocoPrevisto(member?.almoco_previsto?.slice(0, 5) ?? '');
      setDuracaoAlmoco(String(member?.duracao_almoco_min ?? 120));
      setTermoAssinadoEm(member?.termo_assinado_em ?? '');
      setPapel(papelRow?.papel ?? SEM_VALOR);
      setModelo(member?.modelo_intervalo ?? 'almoco_2h');
      setModeloOriginal(member?.modelo_intervalo ?? 'almoco_2h');
      setForaDoPonto(Boolean(member?.fora_do_ponto));
      const permissoes = ((aberturaRow ?? []) as { permissao: string }[]).map((p) => p.permissao);
      setPodeAbrirLoja(permissoes.includes('abertura_coletiva'));
      setPodeAbrirLojaOriginal(permissoes.includes('abertura_coletiva'));
      setPodeForaDaRede(permissoes.includes('bater_pelo_painel'));
      setPodeForaDaRedeOriginal(permissoes.includes('bater_pelo_painel'));

      // O café é por empresa: sem ele ligado, os modelos nem podem ser escolhidos.
      if (member?.empresa_id) {
        const { data: ativo } = await supabase.rpc('ponto_cafe_ativo', {
          p_empresa_id: member.empresa_id,
        });
        if (!cancelado) setCafeAtivo(Boolean(ativo));
      }

      setCarregando(false);
    };

    load();
    return () => {
      cancelado = true;
    };
  }, [userId]);

  const escalasDaEmpresa = escalas.filter(
    (e) => empresaId === SEM_VALOR || e.empresa_id === empresaId
  );

  const salvar = async () => {
    setSalvando(true);

    const { error: membroError } = await supabase
      .from('staff_members')
      .update({
        empresa_id: empresaId === SEM_VALOR ? null : empresaId,
        escala_id: escalaId === SEM_VALOR ? null : escalaId,
        almoco_previsto: almocoPrevisto || null,
        duracao_almoco_min: Number(duracaoAlmoco) || 120,
        termo_assinado_em: termoAssinadoEm || null,
        fora_do_ponto: foraDoPonto,
      })
      .eq('user_id', userId);

    if (membroError) {
      setSalvando(false);
      toast({ title: 'Não foi possível salvar', description: membroError.message, variant: 'destructive' });
      return;
    }

    if (papel === SEM_VALOR) {
      await supabase.from('equipe_papeis').delete().eq('user_id', userId);
    } else {
      const { error: papelError } = await supabase
        .from('equipe_papeis')
        .upsert({ user_id: userId, papel: papel as EquipePapel }, { onConflict: 'user_id' });
      if (papelError) {
        setSalvando(false);
        toast({
          title: 'Dados salvos, mas o papel de equipe não',
          description: papelError.message,
          variant: 'destructive',
        });
        return;
      }
    }

    // O modelo de intervalo vai pela função, não pelo update direto: é ela que
    // registra a data da troca e barra modelo com café quando ele está
    // desligado na empresa.
    if (modelo !== modeloOriginal) {
      const { error: modeloError } = await supabase.rpc('ponto_definir_modelo_intervalo', {
        p_funcionario_id: userId,
        p_modelo: modelo as 'almoco_2h' | 'almoco_1h30_cafe_2x15' | 'almoco_1h30_cafe_1x30',
      });
      if (modeloError) {
        setSalvando(false);
        toast({
          title: 'Dados salvos, mas o modelo de intervalo não',
          description: modeloError.message,
          variant: 'destructive',
        });
        return;
      }
      setModeloOriginal(modelo);
    }

    // Permissão de abrir a loja: é nominal, dada a pessoas específicas. Sem
    // ela o botão "Abrir loja" nem aparece no quiosque.
    if (podeAbrirLoja !== podeAbrirLojaOriginal) {
      const { error: permError } = podeAbrirLoja
        ? await supabase
            .from('ponto_permissoes')
            .upsert(
              { user_id: userId, permissao: 'abertura_coletiva' },
              { onConflict: 'user_id,permissao' }
            )
        : await supabase
            .from('ponto_permissoes')
            .delete()
            .eq('user_id', userId)
            .eq('permissao', 'abertura_coletiva');

      if (permError) {
        setSalvando(false);
        toast({
          title: 'Dados salvos, mas a permissão de abrir a loja não',
          description: permError.message,
          variant: 'destructive',
        });
        return;
      }
      setPodeAbrirLojaOriginal(podeAbrirLoja);
    }

    if (podeForaDaRede !== podeForaDaRedeOriginal) {
      const { error: foraError } = podeForaDaRede
        ? await supabase
            .from('ponto_permissoes')
            .upsert(
              { user_id: userId, permissao: 'bater_pelo_painel' },
              { onConflict: 'user_id,permissao' }
            )
        : await supabase
            .from('ponto_permissoes')
            .delete()
            .eq('user_id', userId)
            .eq('permissao', 'bater_pelo_painel');

      if (foraError) {
        setSalvando(false);
        toast({
          title: 'Dados salvos, mas a permissão de bater fora da loja não',
          description: foraError.message,
          variant: 'destructive',
        });
        return;
      }
      setPodeForaDaRedeOriginal(podeForaDaRede);
    }

    setSalvando(false);
    toast({ title: 'Dados de equipe salvos' });
  };

  if (!isEquipeAdmin) return null;

  if (carregando) {
    return <p className="text-sm text-muted-foreground border-t pt-3">Carregando dados de equipe...</p>;
  }

  return (
    <div className="border-t pt-3 space-y-3">
      <p className="text-sm font-medium">Equipe (atrasos e advertências)</p>

      {empresas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma empresa cadastrada ainda. Cadastre a razão social e o CNPJ antes de vincular
          colaboradores — o horário previsto vem da escala da empresa.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Empresa</Label>
          <Select
            value={empresaId}
            onValueChange={(valor) => {
              setEmpresaId(valor);
              setEscalaId(SEM_VALOR);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem empresa</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.razao_social}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Escala</Label>
          <Select value={escalaId} onValueChange={setEscalaId}>
            <SelectTrigger>
              <SelectValue placeholder="Sem escala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem escala</SelectItem>
              {escalasDaEmpresa.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome} (entra {e.entrada.slice(0, 5)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Papel no módulo Equipe</Label>
          <Select value={papel} onValueChange={setPapel}>
            <SelectTrigger>
              <SelectValue placeholder="Sem papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_VALOR}>Sem papel</SelectItem>
              <SelectItem value="colaborador">Colaborador</SelectItem>
              <SelectItem value="gestor">Gestor</SelectItem>
              <SelectItem value="admin">Admin de equipe</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Horário previsto do almoço</Label>
          <Input
            type="time"
            inputMode="numeric"
            value={almocoPrevisto}
            onChange={(e) => setAlmocoPrevisto(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Só informativo — o atraso do retorno é medido pela duração.
          </p>
        </div>

        <div className="space-y-1">
          <Label>Duração do almoço (minutos)</Label>
          <Input
            inputMode="numeric"
            value={duracaoAlmoco}
            onChange={(e) => setDuracaoAlmoco(e.target.value.replace(/\D/g, '').slice(0, 3))}
          />
          <p className="text-xs text-muted-foreground">
            Retorno esperado = saída real + esta duração.
          </p>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Bate ponto?</Label>
          <button
            type="button"
            onClick={() => setForaDoPonto((v) => !v)}
            className="flex items-start gap-3 text-left w-full rounded-lg border px-3 py-2.5 hover:bg-accent transition-colors"
          >
            <span
              className={`h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold ${
                foraDoPonto ? 'border-[#6B7280] bg-[#6B7280] text-white' : 'border-muted-foreground/40'
              }`}
            >
              {foraDoPonto ? '✓' : ''}
            </span>
            <span className="text-sm">
              Esta pessoa não bate ponto
              <span className="block text-xs text-muted-foreground mt-0.5">
                Para dono e sócio, que entram por e-mail e senha e não têm PIN. Tira a pessoa dos
                avisos de cadastro incompleto do Ponto.
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Abrir a loja pelo ponto</Label>
          <button
            type="button"
            onClick={() => setPodeAbrirLoja((v) => !v)}
            className="flex items-start gap-3 text-left w-full rounded-lg border px-3 py-2.5 hover:bg-accent transition-colors"
          >
            <span
              className={`h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold ${
                podeAbrirLoja
                  ? 'border-[#0F6B5C] bg-[#0F6B5C] text-white'
                  : 'border-muted-foreground/40'
              }`}
            >
              {podeAbrirLoja ? '✓' : ''}
            </span>
            <span className="text-sm">
              Pode registrar a abertura e bater a entrada de quem estava na porta
              <span className="block text-xs text-muted-foreground mt-0.5">
                Sem isso, o botão "Abrir loja" nem aparece no computador da loja para esta pessoa.
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Bater fora da loja</Label>
          <button
            type="button"
            onClick={() => setPodeForaDaRede((v) => !v)}
            className="flex items-start gap-3 text-left w-full rounded-lg border px-3 py-2.5 hover:bg-accent transition-colors"
          >
            <span
              className={`h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center text-[11px] font-bold ${
                podeForaDaRede ? 'border-[#B8860B] bg-[#B8860B] text-white' : 'border-muted-foreground/40'
              }`}
            >
              {podeForaDaRede ? '✓' : ''}
            </span>
            <span className="text-sm">
              Pode bater pelo painel, de qualquer lugar
              <span className="block text-xs text-muted-foreground mt-0.5">
                Sem isso o PIN da pessoa só é aceito dentro do Wi-Fi da loja. Marque só para quem
                administra: a batida de fora perde a prova de que a pessoa estava na loja.
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-1">
          <Label>Modelo de intervalo</Label>
          <Select
            value={modelo}
            onValueChange={setModelo}
            disabled={!cafeAtivo}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="almoco_2h">Almoço de 2h (padrão)</SelectItem>
              <SelectItem value="almoco_1h30_cafe_2x15">
                Almoço 1h30 + café 15 min de manhã e 15 à tarde
              </SelectItem>
              <SelectItem value="almoco_1h30_cafe_1x30">
                Almoço 1h30 + café de 30 min (manhã ou tarde)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {cafeAtivo
              ? 'A troca vale a partir do dia seguinte. O intervalo total continua sendo 2h.'
              : 'As pausas de café estão desligadas nesta empresa. Ligue em Ponto > Configurações antes de usar os modelos com café.'}
          </p>
        </div>

        <div className="space-y-1">
          <Label>Termo de adesão assinado em</Label>
          <Input
            type="date"
            value={termoAssinadoEm}
            onChange={(e) => setTermoAssinadoEm(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sem termo, a ciência eletrônica é bloqueada e o registro vai pro fluxo de papel.
          </p>
        </div>
      </div>

      <Button size="sm" variant="outline" onClick={salvar} disabled={salvando}>
        {salvando ? 'Salvando...' : 'Salvar dados de equipe'}
      </Button>
    </div>
  );
};

export default EquipeFuncionarioFields;
