-- Relatório mensal pra contabilidade (PRD seção 6, item 6).
--
-- "Minutos não abonados" é o que vai pro desconto: conta só atraso fora da
-- tolerância que não foi abonado nem compensado (R5 — atraso compensado sai
-- do desconto mas continua contando no escalonamento, por isso aparece numa
-- coluna separada em vez de sumir do relatório).
create or replace function public.equipe_relatorio_mensal(
  p_empresa_id uuid,
  p_competencia date
)
returns table (
  colaborador_id uuid,
  colaborador text,
  ocorrencias int,
  minutos_desconto int,
  ocorrencias_abonadas int,
  ocorrencias_compensadas int,
  minutos_compensados int,
  ocorrencias_na_tolerancia int,
  medidas_no_mes int
)
language sql security definer stable
set search_path = public
as $$
  select
    sm.user_id,
    sm.display_name,
    count(*) filter (
      where a.dentro_tolerancia = false
        and a.status not in ('abonado', 'compensado', 'substituido')
    )::int,
    coalesce(sum(a.minutos_atraso) filter (
      where a.dentro_tolerancia = false
        and a.status not in ('abonado', 'compensado', 'substituido')
    ), 0)::int,
    count(*) filter (where a.status = 'abonado')::int,
    count(*) filter (where a.status = 'compensado')::int,
    coalesce(sum(a.minutos_atraso) filter (where a.status = 'compensado'), 0)::int,
    count(*) filter (where a.dentro_tolerancia = true)::int,
    (
      select count(*)::int
      from equipe_medidas m
      where m.colaborador_id = sm.user_id
        and date_trunc('month', m.data_aplicacao) = date_trunc('month', p_competencia)
        and m.status in ('aplicada', 'aguardando_assinatura')
    )
  from staff_members sm
  left join equipe_atrasos a
    on a.colaborador_id = sm.user_id
   and date_trunc('month', a.data) = date_trunc('month', p_competencia)
   and a.status <> 'substituido'
  where sm.empresa_id = p_empresa_id
    and p_empresa_id in (select equipe_empresas_visiveis())
  group by sm.user_id, sm.display_name
  order by sm.display_name
$$;

-- Alerta do art. 74, §2º da CLT: acima de 20 funcionários o controle de ponto
-- passa a ser obrigatório. O PRD pede que o admin seja avisado ao cruzar essa
-- linha, por empresa.
create or replace function public.equipe_contagem_funcionarios(p_empresa_id uuid)
returns int
language sql security definer stable
set search_path = public
as $$
  select count(*)::int from staff_members where empresa_id = p_empresa_id
$$;
