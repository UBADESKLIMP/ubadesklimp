

## Correção: Filtro por Marca não Funcionando

---

### Problema Identificado

O campo `brand` existe no banco de dados e alguns produtos já têm valores de marca definidos, mas o hook `useProducts.ts` não está incluindo esse campo em dois lugares críticos:

1. **`sanitizeProductPayload`** - O campo `brand` não está na lista de campos permitidos, então quando você salva/atualiza um produto, a marca é ignorada
2. **Mapeamento do retorno** - O campo `brand` não está sendo mapeado quando os produtos são retornados do banco

---

### Solução

Modificar o arquivo `src/hooks/useProducts.ts` para incluir o campo `brand`:

#### 1. Adicionar `brand` na lista `allowedKeys`:

```typescript
const allowedKeys = [
  'name',
  'description',
  // ... outros campos ...
  'line_type',
  'brand'  // ← ADICIONAR
];
```

#### 2. Adicionar `brand` no mapeamento do produto:

```typescript
return {
  id: product.id,
  name: product.name,
  // ... outros campos ...
  line_type: (product.line_type || 'limpeza') as 'limpeza' | 'automotivo',
  brand: product.brand || null,  // ← ADICIONAR
  created_at: product.created_at,
  // ...
};
```

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/hooks/useProducts.ts` | Adicionar `brand` em `allowedKeys` (linha ~48) e no mapeamento do produto (linha ~124) |

---

### Resultado Esperado

Após a correção:
- Os produtos automotivos terão o campo `brand` disponível na aplicação
- O filtro por marca na página Automotivo funcionará corretamente
- Ao editar um produto no Admin, a marca será salva corretamente

