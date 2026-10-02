-- O append-only precisa de uma fresta controlada: o PRD (4.5) manda o
-- funcionário confirmar ou contestar uma entrada que a responsável bateu por
-- ele, e isso acontece DEPOIS da marcação existir.
--
-- A primeira versão resolvia desligando o trigger dentro da função — o que
-- derruba a trava pro banco inteiro por um instante e afeta transação
-- concorrente. Aqui o próprio trigger passa a aceitar exclusivamente a
-- transição de confirmação, e só saindo de 'pendente'. Qualquer outro campo
-- (hora, tipo, hash, funcionário) continua intocável, inclusive pro admin.
create or replace function public.ponto_trg_marcacoes_append_only()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'ponto_marcacoes é append-only: marcação não pode ser apagada, nem por admin.';
  end if;

  if old.confirmacao = 'pendente'
     and new.confirmacao in ('confirmada', 'contestada', 'confirmada_por_prazo')
     and new.id = old.id
     and new.empresa_id = old.empresa_id
     and new.funcionario_id = old.funcionario_id
     and new.tipo = old.tipo
     and new.registrado_em = old.registrado_em
     and new.local_id is not distinct from old.local_id
     and new.estacao_id is not distinct from old.estacao_id
     and new.dispositivo_id is not distinct from old.dispositivo_id
     and new.origem = old.origem
     and new.marcado_por is not distinct from old.marcado_por
     and new.estava_na_porta = old.estava_na_porta
     and new.ip is not distinct from old.ip
     and new.hash is not distinct from old.hash
     and new.hash_anterior is not distinct from old.hash_anterior then
    return new;
  end if;

  raise exception
    'ponto_marcacoes é append-only: só a confirmação do funcionário pode mudar, e uma vez só. Correção de marcação vai por justificativa (Parte 2).';
end;
$$;

-- A função de confirmação não mexe mais em trigger.
create or replace function public.ponto_confirmar_marcacao(
  p_marcacao_id uuid, p_confirma boolean
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_m record;
  v_novo public.ponto_confirmacao;
begin
  select * into v_m from ponto_marcacoes where id = p_marcacao_id;
  if v_m is null or v_m.funcionario_id <> auth.uid() then
    raise exception 'Marcação não encontrada para você.';
  end if;
  if v_m.confirmacao <> 'pendente' then
    return jsonb_build_object('ok', false, 'mensagem', 'Esta marcação já foi respondida.');
  end if;

  v_novo := case when p_confirma then 'confirmada' else 'contestada' end;
  update ponto_marcacoes set confirmacao = v_novo where id = p_marcacao_id;

  return jsonb_build_object('ok', true, 'confirmacao', v_novo);
end;
$$;

-- P24: sem resposta em 48h, conta como confirmada. Roda por agendamento.
create or replace function public.ponto_confirmar_por_prazo()
returns int language plpgsql security definer set search_path = public as $$
declare v_qtd int;
begin
  with alvo as (
    select id from ponto_marcacoes
    where confirmacao = 'pendente' and registrado_em < now() - interval '48 hours'
  )
  update ponto_marcacoes m set confirmacao = 'confirmada_por_prazo'
  from alvo where m.id = alvo.id;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
