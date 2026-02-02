

## Busca Ignorando Acentos

---

### O que será feito

Criar uma função utilitária que remove acentos dos textos e aplicá-la em todos os filtros de busca do sistema, permitindo que "plastico" encontre "plástico".

---

### Solução Técnica

Usar a função JavaScript `normalize('NFD')` combinada com regex para remover marcas diacríticas (acentos):

```typescript
const normalizeText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};
```

**Como funciona:**
- `normalize('NFD')` - Separa a letra base do acento (ex: "é" vira "e" + "´")
- `replace(/[\u0300-\u036f]/g, '')` - Remove os caracteres de acento
- `toLowerCase()` - Converte para minúsculas

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/lib/utils.ts` | Adicionar função `normalizeText` |
| `src/components/Products.tsx` | Usar `normalizeText` no filtro de busca |
| `src/pages/Automotivo.tsx` | Usar `normalizeText` no filtro de busca |
| `src/pages/Admin.tsx` | Usar `normalizeText` no filtro de busca |
| `src/components/AutomotiveProductsManager.tsx` | Usar `normalizeText` no filtro de busca |

---

### Exemplo de Uso

**Antes:**
```typescript
product.name.toLowerCase().includes(searchTerm.toLowerCase())
```

**Depois:**
```typescript
normalizeText(product.name).includes(normalizeText(searchTerm))
```

---

### Resultado Esperado

- "plastico" encontra "Plástico"
- "açao" encontra "Ação"  
- "limão" é encontrado pesquisando "limao"
- Funciona em todos os campos de busca do sistema (produtos de limpeza, automotivos e admin)

