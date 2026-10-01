import { useCallback, useEffect, useState } from 'react';
import { Building2, CalendarClock, Loader2, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatarCnpj, somenteDigitos, cnpjValido } from '@/lib/equipeValidations';

interface Empresa {
  id: string;
  razao_social: string;
  cnpj: string;
  ativo: boolean;
  funcionarios: number;
}

interface Escala {
  id: string;
  empresa_id: string;
  nome: string;
  entrada: string;
  saida: string;
  tol_marcacao_min: number;
  tol_dia_min: number;
  ativo: boolean;
}

// Acima deste número o controle de ponto vira obrigatório (art. 74, §2º CLT).
const LIMITE_PONTO_OBRIGATORIO = 20;

const EquipeConfig = () => {
  const { toast } = useToast();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [novaRazao, setNovaRazao] = useState('');
  const [novoCnpj, setNovoCnpj] = useState('');

  const [escalaEmpresaId, setEscalaEmpresaId] = useState<string | null>(null);
  // Jornada real da loja: 08:00 às 18:00 com 2h de almoço.
  const [novaEscala, setNovaEscala] = useState({
    nome: '',
    entrada: '08:00',
    saida: '18:00',
    tol_marcacao_min: '5',
    tol_dia_min: '10',
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [{ data: empresasData }, { data: escalasData }, { data: membros }] = await Promise.all([
      supabase.from('empresas').select('id, razao_social, cnpj, ativo').order('razao_social'),
      supabase
        .from('equipe_escalas')
        .select('id, empresa_id, nome, entrada, saida, tol_marcacao_min, tol_dia_min, ativo')
        .order('nome'),
      supabase.from('staff_members').select('empresa_id'),
    ]);

    const contagem = new Map<string, number>();
    for (const m of membros ?? []) {
      if (m.empresa_id) contagem.set(m.empresa_id, (contagem.get(m.empresa_id) ?? 0) + 1);
    }

    setEmpresas(
      (empresasData ?? []).map((e) => ({ ...e, funcionarios: contagem.get(e.id) ?? 0 }))
    );
    setEscalas(escalasData ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarEmpresa = async () => {
    const razao = novaRazao.trim();
    const cnpj = somenteDigitos(novoCnpj);

    if (razao.length < 2) {
      toast({ title: 'Informe a razão social', variant: 'destructive' });
      return;
    }
    if (!cnpjValido(cnpj)) {
      toast({
        title: 'CNPJ inválido',
        description: 'Confira os 14 dígitos — o dígito verificador não bate.',
        variant: 'destructive',
      });
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from('empresas').insert({ razao_social: razao, cnpj });
    setSalvando(false);

    if (error) {
      toast({
        title: 'Não foi possível cadastrar',
        description: error.message.includes('duplicate') ? 'Esse CNPJ já está cadastrado.' : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Empresa cadastrada', description: 'As configurações padrão já foram criadas.' });
    setNovaRazao('');
    setNovoCnpj('');
    await carregar();
  };

  const alternarEmpresaAtiva = async (empresa: Empresa) => {
    const { error } = await supabase
      .from('empresas')
      .update({ ativo: !empresa.ativo })
      .eq('id', empresa.id);
    if (error) {
      toast({ title: 'Não foi possível alterar', description: error.message, variant: 'destructive' });
      return;
    }
    await carregar();
  };

  const criarEscala = async (empresaId: string) => {
    if (novaEscala.nome.trim().length < 2) {
      toast({ title: 'Dê um nome pra escala', description: 'Ex.: Padrão 08h-17h', variant: 'destructive' });
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from('equipe_escalas').insert({
      empresa_id: empresaId,
      nome: novaEscala.nome.trim(),
      entrada: novaEscala.entrada,
      saida: novaEscala.saida,
      tol_marcacao_min: Number(novaEscala.tol_marcacao_min) || 5,
      tol_dia_min: Number(novaEscala.tol_dia_min) || 10,
    });
    setSalvando(false);

    if (error) {
      toast({ title: 'Não foi possível criar a escala', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Escala criada' });
    setNovaEscala({ nome: '', entrada: '08:00', saida: '17:00', tol_marcacao_min: '5', tol_dia_min: '10' });
    setEscalaEmpresaId(null);
    await carregar();
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#12121a] border-blue-500/20">
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-white">Nova empresa</h3>
            <p className="text-xs text-blue-300/50 mt-1">
              A razão social e o CNPJ daqui são os que saem na advertência escrita, então precisam
              bater com o contrato de trabalho.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">Razão social</Label>
              <Input
                value={novaRazao}
                onChange={(e) => setNovaRazao(e.target.value)}
                placeholder="Ubadesklimp Comércio LTDA"
                className="bg-[#0c0c14] border-blue-500/20 h-11"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-blue-300/70 text-xs">CNPJ</Label>
              <Input
                value={formatarCnpj(novoCnpj)}
                onChange={(e) => setNovoCnpj(somenteDigitos(e.target.value).slice(0, 14))}
                inputMode="numeric"
                placeholder="00.000.000/0001-00"
                className="bg-[#0c0c14] border-blue-500/20 h-11 font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={criarEmpresa}
                disabled={salvando}
                className="bg-blue-600 hover:bg-blue-500 h-11 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {empresas.length === 0 ? (
        <Card className="bg-[#12121a] border-blue-500/20">
          <CardContent className="py-10 text-center">
            <Building2 className="h-10 w-10 text-blue-500/40 mx-auto mb-3" />
            <p className="text-sm text-blue-300/60">
              Nenhuma empresa cadastrada. Comece por aí — sem empresa não dá pra vincular
              colaborador nem calcular atraso.
            </p>
          </CardContent>
        </Card>
      ) : (
        empresas.map((empresa) => {
          const escalasDaEmpresa = escalas.filter((e) => e.empresa_id === empresa.id);
          const passouDoLimite = empresa.funcionarios > LIMITE_PONTO_OBRIGATORIO;

          return (
            <Card key={empresa.id} className="bg-[#12121a] border-blue-500/20">
              <CardContent className="pt-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-white">{empresa.razao_social}</h3>
                    <p className="font-mono text-xs text-blue-300/60 mt-0.5">
                      {formatarCnpj(empresa.cnpj)}
                    </p>
                    <p className="text-xs text-blue-300/50 mt-1">
                      <span className="font-mono tabular-nums">{empresa.funcionarios}</span>{' '}
                      funcionário(s) vinculado(s)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-blue-300/60">Ativa</Label>
                    <Switch
                      checked={empresa.ativo}
                      onCheckedChange={() => alternarEmpresaAtiva(empresa)}
                    />
                  </div>
                </div>

                {passouDoLimite && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#f0b429]/40 bg-[#f0b429]/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-[#f0b429] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#f0b429]">
                      Esta empresa passou de {LIMITE_PONTO_OBRIGATORIO} funcionários. A partir daí o
                      controle de ponto é obrigatório por lei (art. 74, §2º da CLT) — este módulo
                      documenta ocorrências, mas não substitui o ponto oficial.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm text-blue-300/80 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4" />
                      Escalas
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setEscalaEmpresaId(escalaEmpresaId === empresa.id ? null : empresa.id)
                      }
                      className="text-blue-300/70 hover:text-white hover:bg-blue-500/10"
                    >
                      {escalaEmpresaId === empresa.id ? 'Cancelar' : 'Nova escala'}
                    </Button>
                  </div>

                  {escalasDaEmpresa.length === 0 && escalaEmpresaId !== empresa.id && (
                    <p className="text-xs text-blue-300/50 py-2">
                      Sem escala. O horário previsto de entrada vem daqui — sem ela, não dá pra
                      lançar atraso pra ninguém desta empresa.
                    </p>
                  )}

                  {escalasDaEmpresa.map((escala) => (
                    <div
                      key={escala.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-500/10 bg-[#0c0c14] px-3 py-2"
                    >
                      <span className="text-sm text-white">{escala.nome}</span>
                      <span className="font-mono text-xs text-blue-300/60 tabular-nums">
                        {escala.entrada.slice(0, 5)} às {escala.saida.slice(0, 5)}
                      </span>
                      <span className="text-xs text-blue-300/50">
                        tolerância{' '}
                        <span className="font-mono tabular-nums">{escala.tol_marcacao_min}</span> min
                        por marcação,{' '}
                        <span className="font-mono tabular-nums">{escala.tol_dia_min}</span> no dia
                      </span>
                      {!escala.ativo && (
                        <span className="text-[10px] uppercase tracking-wider text-[#6B7280] border-2 border-[#6B7280]/70 bg-[#6B7280]/10 rounded-[3px] px-2 py-0.5 -rotate-[1.5deg]">
                          inativa
                        </span>
                      )}
                    </div>
                  ))}

                  {escalaEmpresaId === empresa.id && (
                    <div className="rounded-lg border border-blue-500/20 bg-[#0c0c14] p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-blue-300/70 text-xs">Nome</Label>
                          <Input
                            value={novaEscala.nome}
                            onChange={(e) => setNovaEscala({ ...novaEscala, nome: e.target.value })}
                            placeholder="Padrão 08h-17h"
                            className="bg-[#12121a] border-blue-500/20 h-11"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-blue-300/70 text-xs">Entrada</Label>
                            <Input
                              type="time"
                              inputMode="numeric"
                              value={novaEscala.entrada}
                              onChange={(e) => setNovaEscala({ ...novaEscala, entrada: e.target.value })}
                              className="bg-[#12121a] border-blue-500/20 h-11 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-blue-300/70 text-xs">Saída</Label>
                            <Input
                              type="time"
                              inputMode="numeric"
                              value={novaEscala.saida}
                              onChange={(e) => setNovaEscala({ ...novaEscala, saida: e.target.value })}
                              className="bg-[#12121a] border-blue-500/20 h-11 font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-blue-300/70 text-xs">
                            Tolerância por marcação (min)
                          </Label>
                          <Input
                            inputMode="numeric"
                            value={novaEscala.tol_marcacao_min}
                            onChange={(e) =>
                              setNovaEscala({
                                ...novaEscala,
                                tol_marcacao_min: e.target.value.replace(/\D/g, '').slice(0, 2),
                              })
                            }
                            className="bg-[#12121a] border-blue-500/20 h-11 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-blue-300/70 text-xs">Tolerância no dia (min)</Label>
                          <Input
                            inputMode="numeric"
                            value={novaEscala.tol_dia_min}
                            onChange={(e) =>
                              setNovaEscala({
                                ...novaEscala,
                                tol_dia_min: e.target.value.replace(/\D/g, '').slice(0, 2),
                              })
                            }
                            className="bg-[#12121a] border-blue-500/20 h-11 font-mono"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-blue-300/50">
                        O padrão legal é 5 min por marcação e 10 no dia (art. 58, §1º da CLT).
                        Passando disso, o atraso conta integral desde o horário previsto.
                      </p>

                      <Button
                        onClick={() => criarEscala(empresa.id)}
                        disabled={salvando}
                        className="bg-blue-600 hover:bg-blue-500 h-11"
                      >
                        Criar escala
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
};

export default EquipeConfig;
