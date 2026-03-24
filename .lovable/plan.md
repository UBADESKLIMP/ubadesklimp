

## Limpar Tudo e Recomeçar do Zero

### Plano

**Passo 1: Zerar todas as URLs de imagem no banco** (migration)
```sql
UPDATE products SET image_url = NULL;
UPDATE product_variations SET image_url = NULL;
UPDATE product_fragrances SET image_url = NULL;
```

**Passo 2: Esvaziar o bucket do Supabase**
- Executar a Edge Function `cleanup-storage` já existente para deletar todos os arquivos do bucket `product-images`

**Passo 3: Re-upload manual pelo admin**
- Você sobe todas as imagens novamente pelo painel `/admin`
- Todas irão direto para o Cloudinary (já configurado no frontend)
- Zero dependência do Supabase Storage daqui pra frente

### Resultado
- Banco limpo, sem URLs apontando para lugar nenhum
- Bucket vazio = zero consumo de storage/egress
- Após re-upload, tudo servido pelo Cloudinary CDN gratuitamente
- A tabela `image_urls_backup` continua existindo caso precise consultar URLs antigas

### Observação
A Edge Function `migrate-images-to-cloudinary` não será mais necessária após isso, mas pode ficar como referência.

