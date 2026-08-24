# Produtos não públicos + correção de scroll no admin

## Contexto

O catálogo de produtos é único (mesma tabela `products` serve o site público e o
módulo interno de compras). Existem itens que a loja precisa comprar e controlar
(fornecedor, faltante, cotação) mas que não devem aparecer na vitrine pro cliente
final. Hoje não há como marcar isso — todo produto cadastrado é automaticamente
público.

Separadamente, o usuário reportou que ao editar um produto e salvar, a aba
Produtos do admin volta pro topo da tela, obrigando a rolar de novo até o
produto a cada alteração — atrito forte em edições sequenciais (ex: trocar
fotos de vários produtos em sequência).

## 1. Produtos públicos vs. não públicos

### Modelo de dados

Nova coluna em `products`:

```sql
alter table products
  add column is_public boolean not null default true;
```

Todos os 113 produtos existentes ficam `true` automaticamente (nada muda no
site com a migration). Produtos novos nascem `true` por padrão.

### Site público

`useProducts()` sem argumentos passa a filtrar `is_public = true` na query.
Isso cobre `Products.tsx`, `Cart.tsx` e `Automotivo.tsx` sem precisar alterar
esses arquivos — o filtro fica só no hook.

### Admin

`useProducts({ includeNonPublic: true })` — flag explícita pra trazer todos os
produtos, públicos e não públicos. Usado em `Admin.tsx`,
`AutomotiveProductsManager.tsx` e `ProductsHomeSummary.tsx` (todos
admin-only).

Escolha deliberada: o padrão do hook é "só público" (seguro por padrão) — um
consumidor novo do hook que esqueça de pensar nisso nunca vaza produto não
público pro site sem pedir explicitamente.

Na aba Produtos do admin:
- Lista de cima continua igual (produtos públicos, ordem arrastável já
  existente).
- Seção nova embaixo, "Produtos não públicos", mesmo grid/card, sem
  drag-and-drop (esses produtos não aparecem na vitrine, não faz sentido
  ordenar exibição).
- Cada card ganha um switch "Público". Desligar move o produto pra seção de
  baixo. Ligar volta ele pra lista de cima, no fim da ordem atual (usuário
  reordena arrastando, como já faz hoje).
- Toggle chama `updateProduct(id, { is_public: novoValor })` e a lista
  reflete via refetch já existente no hook.

Fora de escopo: nenhuma mudança em Faltantes/Cotações/Fornecedores — esses
fluxos já usam o `products` completo vindo do `Admin.tsx`
(`includeNonPublic: true`), então produtos não públicos continuam
aparecendo neles normalmente.

## 2. Preservar posição de rolagem ao editar produto

No `onOpenChange` do `Dialog` de edição em `Admin.tsx`:
- Ao abrir (`open === true`): guardar `window.scrollY` numa ref.
- Ao fechar (`open === false`, seja por salvar ou cancelar): restaurar a
  rolagem pra essa posição via `requestAnimationFrame(() =>
  window.scrollTo({ top: valorGuardado }))`, depois do re-render assentar.

Fix defensivo — não depende de identificar a causa exata do salto pro topo,
só garante que a posição não muda percebidamente entre abrir e fechar o
modal de edição.

## Fora de escopo

- Multi-tenant / múltiplos canais de venda (site, loja física, etc.) — só um
  booleano público/não-público por enquanto.
- Testar no navegador (sessão do admin não está acessível pra automação
  nesta conversa) — mudança vai direto, sem verificação visual.
