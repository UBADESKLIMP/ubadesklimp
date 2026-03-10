

## Migrar Upload de Imagens para Cloudinary e Limpar Supabase

### Contexto
O Supabase está com o limite de bandwidth estourado por causa das imagens no Storage. Precisamos:
1. Migrar o upload para o Cloudinary (já configurado: cloud `dclgv77ji`, preset `ubadesklimp`)
2. Orientar a limpeza manual das imagens no bucket do Supabase

### Mudanças no Código

**Arquivo: `src/hooks/useImageUpload.ts`**
- Remover o import do `supabase` client
- Substituir a lógica de upload para usar a API REST do Cloudinary via `fetch`
- Endpoint: `https://api.cloudinary.com/v1_1/dclgv77ji/image/upload`
- Upload preset: `ubadesklimp`
- Manter as validações de tipo e tamanho existentes
- Retornar `data.secure_url` do Cloudinary ao invés do `publicUrl` do Supabase

### Limpeza do Supabase Storage (manual)
Após implementar, o usuário deve acessar o [bucket product-images no Supabase](https://supabase.com/dashboard/project/ccrucholgsffichvzbpz/storage/buckets) e deletar as imagens antigas para liberar espaço. As URLs antigas salvas no banco de dados precisarão ser atualizadas com novas URLs do Cloudinary (re-upload dos produtos).

### Impacto
- Novos uploads vão direto para o CDN do Cloudinary
- Supabase serve apenas dados de texto (redução drástica de bandwidth)
- Imagens antigas no banco continuam apontando para Supabase (precisam ser re-uploadadas gradualmente)

