-- Corrige o trigger genérico de audit: a versão anterior referenciava new.id/old.id
-- diretamente, o que estoura com "record has no field id" nas tabelas de PK
-- composta (equipe_aberturas = empresa_id+data, equipe_config = empresa_id+chave).
-- Isso quebrava o registro de abertura do dia e o seed de config ao criar empresa.
-- Resolver o id via jsonb evita a resolução estática do campo.
create or replace function public.equipe_trg_audit()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_antes jsonb;
  v_depois jsonb;
  v_rec jsonb;
  v_id text;
begin
  v_antes := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_depois := case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end;
  v_rec := coalesce(v_depois, v_antes);

  v_id := coalesce(
    v_rec ->> 'id',
    nullif(concat_ws(':',
      v_rec ->> 'empresa_id',
      v_rec ->> 'data',
      v_rec ->> 'chave',
      v_rec ->> 'medida_id',
      v_rec ->> 'atraso_id'
    ), ''),
    'sem_pk'
  );

  insert into public.equipe_audit_log (tabela, registro_id, acao, dados_antes, dados_depois, user_id)
  values (TG_TABLE_NAME, v_id, TG_OP, v_antes, v_depois, auth.uid());

  return coalesce(new, old);
end;
$$;
