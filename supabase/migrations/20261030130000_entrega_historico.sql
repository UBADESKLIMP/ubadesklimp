-- Histórico de entregas: tudo que o entregador registrou num período (entregue
-- ou voltou, com motivo, quem recebeu e quem entregou), por dia. Só leitura.
create or replace function public.entrega_historico(
  p_empresa_id uuid, p_de date, p_ate date
) returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_entregas_gestor() then
    raise exception 'Só gestor ou admin vê o histórico de entregas.';
  end if;
  if p_empresa_id not in (select entregas_empresas_visiveis()) then
    raise exception 'Sem acesso a essa empresa.';
  end if;
  if p_ate < p_de or p_ate - p_de > 366 then
    raise exception 'Escolha um período de até 1 ano.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'evento_id', ev.id,
      'entrega_id', e.id,
      'dia', (ev.registrado_em at time zone 'America/Sao_Paulo')::date,
      'hora', to_char(ev.registrado_em at time zone 'America/Sao_Paulo', 'HH24:MI'),
      'tipo', ev.tipo::text,
      'motivo', ev.motivo::text,
      'motivo_texto', ev.motivo_texto,
      'quem_recebeu', ev.quem_recebeu,
      'entregador', coalesce(s.display_name, 'Sem nome'),
      'documento', e.documento_tipo || ' ' || e.documento_numero,
      'cliente_nome', e.cliente_nome,
      'cliente_telefone', e.cliente_telefone,
      'bairro', coalesce(b.nome, e.bairro_texto),
      'endereco', trim(concat_ws(', ', e.endereco_logradouro, e.endereco_numero)),
      'valor', e.valor,
      'itens', e.itens
    ) order by ev.registrado_em desc)
    from entrega_eventos ev
    join entregas e on e.id = ev.entrega_id
    left join entrega_bairros b on b.id = e.bairro_id
    left join staff_members s on s.user_id = ev.funcionario_id
    where ev.empresa_id = p_empresa_id
      and (ev.registrado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
  ), '[]'::jsonb);
end;
$function$;

revoke all on function public.entrega_historico(uuid, date, date) from public, anon;
grant execute on function public.entrega_historico(uuid, date, date) to authenticated;
