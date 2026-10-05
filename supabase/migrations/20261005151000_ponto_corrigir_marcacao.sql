-- Corrigir a hora de uma batida.
--
-- Na tela tem que aparecer só o horário certo, no lugar do errado: quem olha o
-- ponto não deveria precisar de explicação pra entender o que está vendo.
--
-- Por baixo nada é apagado nem reescrito. A correção é uma linha nova, e a
-- antiga ganha um ponteiro dizendo quem a substituiu. Todas as telas mostram
-- apenas a linha vigente; a anterior fica guardada e entra na verificação de
-- integridade. Assim a tela fica simples e o registro continua provando que
-- ninguém alterou nada depois do fato.

alter table public.ponto_marcacoes
  add column if not exists substituida_por uuid references public.ponto_marcacoes(id);

create index if not exists idx_ponto_marcacoes_vigentes
  on public.ponto_marcacoes (empresa_id, registrado_em)
  where substituida_por is null;

comment on column public.ponto_marcacoes.substituida_por is
  'Preenchido quando esta batida foi corrigida. A linha que vale é a apontada aqui; esta fica só como histórico.';

-- O append-only ganha a segunda fresta: marcar que esta linha foi substituída.
-- Continua sem poder mudar hora, tipo, pessoa ou hash — nem pra admin.
create or replace function public.ponto_trg_marcacoes_append_only()
returns trigger language plpgsql as $FN$
begin
  if TG_OP = 'DELETE' then
    raise exception 'ponto_marcacoes é append-only: marcação não pode ser apagada, nem por admin.';
  end if;

  -- resposta do funcionário a uma batida feita por outra pessoa
  if old.confirmacao = 'pendente'
     and new.confirmacao in ('confirmada', 'contestada', 'confirmada_por_prazo')
     and new.id = old.id
     and new.empresa_id = old.empresa_id
     and new.funcionario_id = old.funcionario_id
     and new.tipo = old.tipo
     and new.registrado_em = old.registrado_em
     and new.substituida_por is not distinct from old.substituida_por
     and new.hash is not distinct from old.hash
     and new.hash_anterior is not distinct from old.hash_anterior then
    return new;
  end if;

  -- correção: a linha aponta pra que a substituiu, e só isso muda
  if old.substituida_por is null
     and new.substituida_por is not null
     and new.id = old.id
     and new.empresa_id = old.empresa_id
     and new.funcionario_id = old.funcionario_id
     and new.tipo = old.tipo
     and new.registrado_em = old.registrado_em
     and new.confirmacao is not distinct from old.confirmacao
     and new.hash is not distinct from old.hash
     and new.hash_anterior is not distinct from old.hash_anterior then
    return new;
  end if;

  raise exception
    'ponto_marcacoes é append-only: a hora de uma batida não se reescreve. Use a correção, que cria um registro novo apontando para este.';
end;
$FN$;

create or replace function public.ponto_corrigir_marcacao(
  p_marcacao_id uuid,
  p_quando timestamptz,
  p_motivo text
)
returns jsonb language plpgsql security definer set search_path = public, extensions as $FN$
declare
  v_m record;
  v_nome text;
  v_atraso record;
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
begin
  if not public.is_equipe_gestor_ou_admin() then
    raise exception 'Só gestor ou admin corrige uma batida.';
  end if;

  if coalesce(trim(p_motivo), '') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'sem_motivo',
      'mensagem', 'Diga por que está corrigindo. Sem motivo a correção não vale como prova.');
  end if;

  select * into v_m from ponto_marcacoes where id = p_marcacao_id;
  if v_m is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada',
      'mensagem', 'Batida não encontrada.');
  end if;

  if v_m.substituida_por is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_corrigida',
      'mensagem', 'Esta batida já foi corrigida. Corrija a que está valendo.');
  end if;

  if v_m.empresa_id not in (select equipe_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  if p_quando > now() + interval '1 minute' then
    return jsonb_build_object('ok', false, 'motivo', 'no_futuro',
      'mensagem', 'Não dá para marcar uma hora que ainda não chegou.');
  end if;

  select display_name into v_nome from staff_members where user_id = v_m.funcionario_id;

  -- O atraso que nasceu da hora errada sai de cena antes, senão o trigger
  -- enxerga um lançamento ativo no dia e não recalcula com a hora certa.
  select * into v_atraso from equipe_atrasos
  where colaborador_id = v_m.funcionario_id
    and data = (v_m.registrado_em at time zone 'America/Sao_Paulo')::date
    and status <> 'substituido'
  order by created_at desc limit 1;

  if v_atraso.id is not null then
    begin
      update equipe_atrasos set status = 'substituido' where id = v_atraso.id;
    exception when others then
      return jsonb_build_object('ok', false, 'motivo', 'atraso_travado',
        'mensagem', format(
          'O atraso de %s nesse dia já teve ciência ou virou medida, então não dá para refazer o cálculo por aqui. Resolva pelo ajuste de ponto.',
          v_nome));
    end;
  end if;

  v_hash_anterior := public.ponto_ultimo_hash(v_m.empresa_id);
  v_hash := public.ponto_calcular_hash(
    v_m.empresa_id, v_m.funcionario_id, v_m.tipo::text, p_quando, v_hash_anterior);

  insert into ponto_marcacoes (
    empresa_id, funcionario_id, tipo, registrado_em, local_id, estacao_id,
    origem, marcado_por, confirmacao, motivo_lancamento, estava_na_porta,
    ip, user_agent, hash, hash_anterior
  ) values (
    v_m.empresa_id, v_m.funcionario_id, v_m.tipo, p_quando, v_m.local_id, v_m.estacao_id,
    'correcao', auth.uid(), 'pendente', trim(p_motivo), v_m.estava_na_porta,
    public.ponto_ip_origem(), public.ponto_user_agent(), v_hash, v_hash_anterior
  ) returning id into v_id;

  update ponto_marcacoes set substituida_por = v_id where id = p_marcacao_id;

  return jsonb_build_object('ok', true, 'marcacao_id', v_id, 'nome', v_nome,
    'codigo', upper(left(v_hash, 8)),
    'mensagem', format('Hora corrigida para %s. %s confirma ou contesta em Meu ponto.',
                       to_char(p_quando at time zone 'America/Sao_Paulo', 'HH24:MI'), v_nome));
end;
$FN$;
