-- Entrega que entrou numa rota e não foi resolvida até a virada do dia ficava
-- "em_rota" para sempre: a fila só lista na_fila/nao_entregue e a rota de hoje
-- não a tem, então sumia dos dois lados. Ao abrir a fila, o que sobrou de rota
-- de dia anterior volta para a fila (a parada antiga fica como histórico).
create or replace function public.entrega_fila(p_empresa_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare v_res jsonb;
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin vê a fila de entregas.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;

  update entregas e set situacao = 'na_fila', updated_at = now()
  where e.empresa_id = p_empresa_id
    and e.situacao = 'em_rota'
    and not exists (
      select 1 from entrega_paradas p
      join entrega_rotas r on r.id = p.rota_id
      where p.entrega_id = e.id
        and r.data >= (now() at time zone 'America/Sao_Paulo')::date
    );

  select coalesce(jsonb_agg(to_jsonb(x) - 'prioridade' - 'bairro_ordem'
                            order by x.prioridade, x.bairro_ordem, x.cliente_nome), '[]'::jsonb)
  into v_res
  from (
    select e.id, e.documento_tipo, e.documento_numero, e.cliente_nome,
           e.cliente_telefone, e.valor, e.itens, e.situacao::text as situacao,
           e.tentativas,
           coalesce(b.nome, e.bairro_texto) as bairro,
           coalesce(b.ordem, 999999) as bairro_ordem,
           trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)) as endereco,
           e.entregar_em,
           case when e.situacao = 'nao_entregue' then 0 else 1 end as prioridade,
           (select ev.motivo::text from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultimo_motivo,
           (select ev.registrado_em from entrega_eventos ev
             where ev.entrega_id = e.id order by ev.registrado_em desc limit 1) as ultima_tentativa
    from entregas e
    left join entrega_bairros b on b.id = e.bairro_id
    where e.empresa_id = p_empresa_id
      and e.situacao in ('na_fila', 'nao_entregue')
  ) x;

  return v_res;
end;
$function$;
