

## Análise do Egress e Plano de Redução

### Por que o egress não zerou em 1º de abril?

O ciclo de faturamento do Supabase Free Plan **não reseta no dia 1 do mês**. Ele reseta na data de aniversário da criação do projeto. Ou seja, se o projeto foi criado dia 19, o ciclo reseta dia 19 de cada mês. O contador de 8.40 GB é cumulativo dentro desse ciclo.

### De onde vem o egress atual (sem imagens)?

O código não usa mais Supabase Storage. Todo o egress agora é de:

1. **API (PostgREST)** — cada page load faz 3 queries paralelas: `products`, `product_variations`, `product_fragrances` (+ categories, auth checks). Cada visitante gera tráfego.
2. **Auth** — verificação de sessão, login, etc.
3. **Realtime** — conexão WebSocket mantida aberta pelo cliente Supabase (mesmo sem uso explícito).
4. **Preview do Lovable** — cada vez que você edita/visualiza o preview, o app carrega e faz todas essas queries novamente.

### O que ainda pode ser removido

| Item | Ação | Impacto |
|------|-------|---------|
| Bucket `product-images` | Deletar via dashboard (Storage → Buckets) | Mínimo, mas elimina overhead |
| Políticas RLS do bucket | Já são inúteis, ficam nas migrations antigas | Zero impacto (não executam) |
| Edge Functions restantes | Não há mais nenhuma — já limpamos tudo | Nada a fazer |

### Como reduzir o egress de API real

**Passo 1: Deletar o bucket vazio**
- Ir no dashboard Supabase → Storage → deletar `product-images`

**Passo 2: Reduzir queries desnecessárias com cache**
- Configurar o `QueryClient` do React Query com `staleTime` de 5-10 minutos para que as queries de produtos não sejam refeitas a cada navegação
- Isso reduz drasticamente o número de chamadas ao Supabase

**Passo 3: Selecionar apenas colunas necessárias**
- Trocar `.select('*')` por `.select('id,name,price,image_url,...')` nas queries públicas
- Menos dados transferidos = menos egress

**Passo 4: Desabilitar Realtime (se não usa)**
- O cliente Supabase mantém conexão WebSocket ativa por padrão
- Pode ser desabilitado na criação do cliente para economizar

### Sobre a cobrança

O Free Plan inclui 5 GB de egress por ciclo. Você está em 8.40 GB (3.40 GB de overage). O Supabase pode pausar o projeto quando o limite é excedido. A única forma de zerar é **esperar o próximo ciclo** (data de criação do projeto, não dia 1 do mês).

### Resumo das ações

1. Deletar bucket `product-images` manualmente no dashboard
2. Adicionar cache (staleTime) no React Query — reduz re-fetches
3. Usar `.select()` com colunas específicas em vez de `*`
4. Desabilitar Realtime no cliente Supabase

Isso não zera o contador atual, mas reduz drasticamente o consumo futuro para caber nos 5 GB do plano gratuito.

