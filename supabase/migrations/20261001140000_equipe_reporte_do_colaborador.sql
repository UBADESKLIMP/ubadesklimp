-- O funcionário reporta o que aconteceu; o gestor confirma.
--
-- No caderno quem escrevia era o funcionário. Até aqui só o gestor lançava
-- atraso, e o colaborador só reagia ao que já tinha sido lançado. Dois tipos
-- novos fecham isso:
--   'atraso'             — "cheguei atrasado hoje", com a versão dele do que houve
--   'marcacao_duplicada' — "bati duas vezes"
--
-- Reporte do colaborador nasce 'pendente' (a função de criar já faz isso), vai
-- pra fila do gestor e só vira registro de atraso depois de aprovado. Um erro
-- de digitação dele não vira registro disciplinar imutável sem ninguém olhar.
--
-- Corrige junto um defeito que esses tipos novos deixariam gritante: a função
-- criava uma linha em equipe_atrasos sempre que a solicitação trazia uma
-- marcação de entrada, mesmo quando a pessoa chegou NO HORÁRIO — gerando
-- "atraso" de 0 min, dentro da tolerância, pra quem não se atrasou. Com o
-- colaborador reportando "bati errado" em dia normal, a lista de atrasos ia
-- encher de registro fantasma. Agora consulta o cálculo antes e só grava se
-- houver atraso de fato.
create or replace function public.equipe_aplicar_efeitos_justificativa(p_justificativa_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  j record;
  v_entrada time;
  v_empresa_id uuid;
  v_atraso_existente uuid;
  v_calc record;
begin
  select * into j from equipe_justificativas_ponto where id = p_justificativa_id;

  -- Compensação aprovada: o atraso sai do desconto mas segue contando no
  -- escalonamento (R5), por isso vira 'compensado' e não 'abonado'.
  if j.tipo = 'compensacao_atraso' and j.atraso_id is not null then
    update equipe_atrasos
    set status = 'compensado',
        justificativa_ponto_id = j.id,
        updated_at = now()
    where id = j.atraso_id
      and status in ('pendente_ciencia', 'justificativa_pendente', 'ciente');
    return;
  end if;

  -- Tipos que carregam uma marcação de entrada: a entrada informada à mão vale
  -- como a entrada do dia. Falha no sistema e esquecimento não abonam atraso —
  -- explicam a marcação, não desculpam a hora.
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

    -- Só grava se houver atraso de verdade. Entrada no horário (ou dentro da
    -- tolerância) não gera registro.
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
$$;
