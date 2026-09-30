insert into storage.buckets (id, name, public)
values ('equipe-docs', 'equipe-docs', false)
on conflict (id) do nothing;

create policy "Só admin lê termos de adesão"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'termos'
    and public.is_equipe_admin()
  );

create policy "Só admin faz upload de termos de adesão"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'termos'
    and public.is_equipe_admin()
  );

create policy "Colaborador lê os próprios anexos de justificativa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'justificativas'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Gestor/admin lê anexos de justificativa"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'justificativas'
    and public.is_equipe_gestor_ou_admin()
  );

create policy "Colaborador anexa justificativa em pasta própria"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'justificativas'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create view public.equipe_funcionarios_gestor as
select
  user_id,
  display_name,
  empresa_id,
  escala_id,
  almoco_previsto,
  duracao_almoco_min,
  (termo_adesao_path is not null) as termo_adesao_enviado,
  termo_assinado_em
from public.staff_members;

alter view public.equipe_funcionarios_gestor set (security_invoker = true);
