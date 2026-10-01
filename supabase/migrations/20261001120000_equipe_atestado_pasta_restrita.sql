-- J9 / LGPD: atestado médico é dado de saúde. A policy criada junto com o
-- bucket deixava gestor ler QUALQUER anexo de justificativa, incluindo
-- atestado — o PRD (seção 7 da Parte 2) diz que esses são visíveis só pro
-- admin e pro próprio colaborador; o gestor vê apenas "anexo enviado".
--
-- Separa em duas pastas em vez de cruzar caminho com tabela na policy:
--   justificativas/<uid>/...  -> colaborador dono + gestor + admin
--   atestados/<uid>/...       -> colaborador dono + admin apenas
create policy "Colaborador lê os próprios atestados"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'atestados'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Colaborador anexa o próprio atestado"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'atestados'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Admin lê atestados"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'equipe-docs'
    and (storage.foldername(name))[1] = 'atestados'
    and public.is_equipe_admin()
  );
