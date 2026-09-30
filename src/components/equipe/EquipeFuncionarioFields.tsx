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
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    const load = async () => {
      setCarregando(true);
      const [{ data: empresasData }, { data: escalasData }, { data: member }, { data: papelRow }] =
        await Promise.all([
          supabase.from('empresas').select('id, razao_social').eq('ativo', true).order('razao_social'),
          supabase.from('equipe_escalas').select('id, nome, empresa_id, entrada').eq('ativo', true),
          supabase
            .from('staff_members')
            .select('empresa_id, escala_id, almoco_previsto, duracao_almoco_min, termo_assinado_em')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase.from('equipe_papeis').select('papel').eq('user_id', userId).maybeSingle(),
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
