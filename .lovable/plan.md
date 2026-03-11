

## Análise: Google Drive vs Cloudinary para Hospedar Imagens

### Problema com Google Drive como CDN de imagens

Google Drive **não é recomendado** para servir imagens em sites de produção por vários motivos:

1. **Rate limiting**: Google bloqueia requisições frequentes de imagens servidas via Drive (erro 403 após certo volume)
2. **URLs instáveis**: O formato `https://drive.google.com/uc?id=FILE_ID` foi parcialmente descontinuado pelo Google em 2024
3. **Performance ruim**: Sem CDN global, sem cache otimizado, sem redimensionamento automático
4. **CORS**: Problemas frequentes de cross-origin que impedem o carregamento das imagens no site

### Cloudinary (já configurado e funcionando)

O upload para Cloudinary **já está implementado** no código (`useImageUpload.ts`). Ele oferece:
- CDN global rápido
- Redimensionamento automático
- Sem limite prático de bandwidth no plano gratuito (25GB/mês)
- URLs estáveis e confiáveis

### Recomendação

**Manter o Cloudinary** que já está configurado. O trabalho agora é apenas:

1. Criar a Edge Function para limpar o bucket do Supabase
2. Você re-faz upload das imagens (que já tem no Google Drive) pelo painel admin — elas irão automaticamente para o Cloudinary

O Google Drive serve como seu **backup local das imagens**, mas o Cloudinary deve ser o servidor de produção.

Quer que eu prossiga com a criação da Edge Function de limpeza do Supabase Storage para liberar espaço?

