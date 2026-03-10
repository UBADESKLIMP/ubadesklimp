

## Análise: Mover Imagens para Fora do Supabase

### O Problema Real

O erro do Supabase foi `exceed_cached_egress_quota` — isso é sobre **bandwidth (tráfego de dados)**, não espaço em disco. Cada vez que alguém acessa o site e carrega imagens do Supabase Storage, conta no limite de tráfego. Imagens são os maiores consumidores de bandwidth.

### Sim, mover as imagens resolve

Se movermos as imagens para outro serviço gratuito, o Supabase passaria a servir **apenas dados de texto** (nomes, preços, descrições) — que consomem quase nada de bandwidth. Isso reduziria drasticamente o uso.

### Melhor opção gratuita: ImgBB ou Cloudinary

| Serviço | Gratuito | Vantagem |
|---------|----------|----------|
| **Cloudinary** | 25GB bandwidth/mês | CDN global, otimização automática, URLs estáveis |
| **ImgBB** | Ilimitado | Simples, sem conta complexa |
| **Google Drive** | 15GB | URLs instáveis, pode quebrar com rate limits |

**Recomendação: Cloudinary** — é o mais confiável para produção.

### Plano de Implementação

1. **Criar conta gratuita no Cloudinary** (você faz isso manualmente)
2. **Atualizar `useImageUpload.ts`** para fazer upload via Cloudinary API ao invés do Supabase Storage
3. **Produtos existentes** continuam funcionando pois as URLs do Supabase já estão salvas no banco — mas idealmente você re-faria o upload das imagens no Cloudinary e atualizaria as URLs no banco
4. **Opcionalmente**, após migrar tudo, limpar o bucket `product-images` do Supabase para liberar espaço

### Mudanças Técnicas

- **`src/hooks/useImageUpload.ts`**: Trocar o upload do Supabase Storage pelo upload via API do Cloudinary (upload direto do browser, sem necessidade de edge function para o plano gratuito)
- **Nenhuma mudança** nos componentes de exibição — eles já usam URLs absolutas do campo `image_url`

### O que você precisa fazer

1. Criar conta em [cloudinary.com](https://cloudinary.com) (gratuito)
2. Me informar o **cloud name** (é público, aparece no dashboard)
3. Criar um **upload preset unsigned** no painel do Cloudinary (Settings > Upload > Upload presets)

Após isso, eu implemento a mudança no código.

