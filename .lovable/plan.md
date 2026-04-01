

## Desbloquear o Projeto Supabase

### Problema
Seu projeto Supabase está **bloqueado** (erro 402) porque o egress ultrapassou o limite do plano gratuito. O bucket `product-images` ainda existe e precisa ser removido.

### Ação
Executar uma migration SQL para deletar o bucket `product-images` e todos os objetos associados:

```sql
DELETE FROM storage.objects WHERE bucket_id = 'product-images';
DELETE FROM storage.buckets WHERE id = 'product-images';
```

Isso remove o último vestígio do Supabase Storage no projeto. O app já usa Cloudinary para imagens, então não há impacto funcional.

### Resultado esperado
- Bucket eliminado definitivamente
- Redução do overhead de storage
- O projeto continuará bloqueado até o ciclo de egress resetar (na data de aniversário de criação do projeto), ou até você contatar o suporte do Supabase em [supabase.help](https://supabase.help) para solicitar o desbloqueio

### Nota importante
Mesmo após deletar o bucket, o projeto pode continuar retornando 402 até o Supabase liberar. Recomendo **abrir um ticket** em https://supabase.help pedindo o reset da restrição de egress.

