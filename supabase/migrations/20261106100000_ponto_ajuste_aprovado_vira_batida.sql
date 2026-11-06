-- Aprovar um pedido de ajuste agora MEXE no ponto.
--
-- Antes, aprovar "esqueci de bater" só anotava a justificativa (e calculava o
-- atraso): a batida não existia, e o espelho do mês, que lê as batidas, seguia
-- mostrando o dia furado. Agora, ao aprovar:
--   esquecimento       -> a batida esquecida entra no ponto, na hora informada
--   marcacao_incorreta -> a batida errada é substituída por uma na hora certa
--                         (a antiga fica guardada, marcada como substituída)
--   marcacao_duplicada -> a batida repetida sai do ponto (fica guardada)
-- Cada passo é seguro de repetir: aprovar duas vezes não duplica nada.

-- equipe_marcacao_ponto -> ponto_marcacao_tipo
create or replace function public.ponto_tipo_do_ajuste(p_marcacao equipe_marcacao_ponto)
returns ponto_marcacao_tipo
language sql immutable
as $$
  select case p_marcacao
    when 'entrada' then 'entrada'
    when 'saida_almoco' then 'saida_almoco'
    when 'retorno_almoco' then 'retorno_almoco'
    when 'saida' then 'saida'
    when 'hora_extra_inicio' then 'hora_extra_inicio'
    when 'hora_extra_saida' then 'hora_extra_saida'
    when 'saida_intermediaria' then 'saida_pausa'
    when 'retorno_intermediario' then 'retorno_pausa'
  end::public.ponto_marcacao_tipo
$$;

create or replace function public.ponto_aplicar_ajuste_na_marcacao(p_justificativa_id uuid)
returns void
language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare
  j record;
  jm record;
  v_tipo public.ponto_marcacao_tipo;
  v_quando timestamptz;
  v_hash_anterior text;
  v_hash text;
  v_id uuid;
  v_antiga record;
  v_outra uuid;
  v_hora time;
  v_data date;
  v_quem uuid;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;
  if j.id is null then
    return;
  end if;

  v_quem := coalesce(auth.uid(), j.decidido_por, j.criado_por);

  -- ------------------------------------------------ esqueci de bater: lança a batida
  if j.tipo = 'esquecimento' then
    for jm in select * from equipe_justificativa_marcacoes where justificativa_id = j.id loop
      v_tipo := public.ponto_tipo_do_ajuste(jm.marcacao);
      v_quando := (j.data + jm.horario) at time zone 'America/Sao_Paulo';

      -- Hora que ainda não chegou não vira batida.
      if v_quando > now() + interval '1 minute' then
        continue;
      end if;

      -- Já existe essa batida no dia (aprovou duas vezes, ou a pessoa bateu depois).
      if exists (
        select 1 from ponto_marcacoes m
        where m.funcionario_id = j.colaborador_id and m.tipo = v_tipo
          and m.substituida_por is null
          and (m.registrado_em at time zone 'America/Sao_Paulo')::date = j.data
      ) then
        continue;
      end if;

      v_hash_anterior := public.ponto_ultimo_hash(j.empresa_id);
      v_hash := public.ponto_calcular_hash(j.empresa_id, j.colaborador_id, v_tipo::text, v_quando, v_hash_anterior);

      insert into ponto_marcacoes (
        empresa_id, funcionario_id, tipo, registrado_em, origem, marcado_por,
        confirmacao, motivo_lancamento, ip, user_agent, hash, hash_anterior
      ) values (
        j.empresa_id, j.colaborador_id, v_tipo, v_quando, 'lancamento_gestor', v_quem,
        'confirmada', left('Ajuste aprovado: ' || j.motivo, 300),
        public.ponto_ip_origem(), public.ponto_user_agent(), v_hash, v_hash_anterior
      );
    end loop;

  -- ----------------------------------------------- horário errado: substitui a batida
  elsif j.tipo = 'marcacao_incorreta' and j.marcacao_id is not null then
    select * into v_antiga from ponto_marcacoes where id = j.marcacao_id;
    select horario into v_hora from equipe_justificativa_marcacoes
      where justificativa_id = j.id order by horario limit 1;

    if v_antiga.id is not null and v_antiga.substituida_por is null and v_hora is not null then
      v_data := (v_antiga.registrado_em at time zone 'America/Sao_Paulo')::date;
      v_quando := (v_data + v_hora) at time zone 'America/Sao_Paulo';

      if v_quando <= now() + interval '1 minute' then
        -- O atraso do dia foi calculado pela hora antiga: sai da frente para ser
        -- refeito pela nova. Se já teve ciência, fica como está.
        if v_antiga.tipo = 'entrada' then
          begin
            update equipe_atrasos set status = 'substituido'
            where colaborador_id = v_antiga.funcionario_id and data = v_data and status <> 'substituido';
          exception when others then
            null;
          end;
        end if;

        v_hash_anterior := public.ponto_ultimo_hash(v_antiga.empresa_id);
        v_hash := public.ponto_calcular_hash(
          v_antiga.empresa_id, v_antiga.funcionario_id, v_antiga.tipo::text, v_quando, v_hash_anterior);

        insert into ponto_marcacoes (
          empresa_id, funcionario_id, tipo, registrado_em, local_id, estacao_id,
          origem, marcado_por, confirmacao, motivo_lancamento, estava_na_porta,
          ip, user_agent, hash, hash_anterior
        ) values (
          v_antiga.empresa_id, v_antiga.funcionario_id, v_antiga.tipo, v_quando,
          v_antiga.local_id, v_antiga.estacao_id,
          'correcao', v_quem, 'confirmada', left('Ajuste aprovado: ' || j.motivo, 300),
          v_antiga.estava_na_porta,
          public.ponto_ip_origem(), public.ponto_user_agent(), v_hash, v_hash_anterior
        ) returning id into v_id;

        update ponto_marcacoes set substituida_por = v_id where id = v_antiga.id;
      end if;
    end if;

  -- --------------------------------------------------- bati duas vezes: tira a repetida
  elsif j.tipo = 'marcacao_duplicada' and j.marcacao_id is not null then
    select * into v_antiga from ponto_marcacoes where id = j.marcacao_id;

    if v_antiga.id is not null and v_antiga.substituida_por is null then
      -- A repetida passa a apontar para a batida mais próxima do mesmo dia, que é a
      -- que vale. Sem outra batida, não há o que manter: deixa como está.
      select m.id into v_outra
      from ponto_marcacoes m
      where m.funcionario_id = v_antiga.funcionario_id and m.id <> v_antiga.id
        and m.substituida_por is null
        and (m.registrado_em at time zone 'America/Sao_Paulo')::date
            = (v_antiga.registrado_em at time zone 'America/Sao_Paulo')::date
      order by abs(extract(epoch from (m.registrado_em - v_antiga.registrado_em))) limit 1;

      if v_outra is not null then
        update ponto_marcacoes set substituida_por = v_outra where id = v_antiga.id;
      end if;
    end if;
  end if;
end;
$function$;

-- Os efeitos de uma justificativa aprovada: agora a batida primeiro, depois o atraso.
create or replace function public.equipe_aplicar_efeitos_justificativa(p_justificativa_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  j record;
  v_entrada time;
  v_empresa_id uuid;
  v_atraso_existente uuid;
  v_calc record;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;

  perform public.ponto_aplicar_ajuste_na_marcacao(p_justificativa_id);

  if j.tipo = 'compensacao_atraso' and j.atraso_id is not null then
    update equipe_atrasos
    set status = 'compensado',
        justificativa_ponto_id = j.id,
        updated_at = now()
    where id = j.atraso_id
      and status in ('pendente_ciencia', 'justificativa_pendente', 'ciente');
    return;
  end if;

  if j.tipo in ('falha_sistema', 'esquecimento', 'marcacao_incorreta',
                'marcacao_duplicada', 'atraso') then
    select horario into v_entrada
    from equipe_justificativa_marcacoes
    where justificativa_id = p_justificativa_id and marcacao = 'entrada';

    if v_entrada is null then
      return;
    end if;

    select a.id into v_atraso_existente
    from equipe_atrasos a
    where a.colaborador_id = j.colaborador_id
      and a.data = j.data
      and a.marcacao = 'entrada'
      and a.status <> 'substituido';

    if v_atraso_existente is not null then
      return;
    end if;

    select empresa_id into v_empresa_id from staff_members where user_id = j.colaborador_id;

    select * into v_calc from public.equipe_calcular_atraso(
      j.colaborador_id, v_empresa_id, j.data, 'entrada'::equipe_marcacao, v_entrada
    );

    if v_calc.dentro_tolerancia then
      return;
    end if;

    insert into equipe_atrasos (
      colaborador_id, empresa_id, data, marcacao, hora_chegada,
      justificativa_ponto_id, criado_por
    ) values (
      j.colaborador_id, v_empresa_id, j.data, 'entrada', v_entrada,
      j.id, j.criado_por
    );
  end if;
end;
$function$;
