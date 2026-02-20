

## Corrigir Cores dos Badges de Acao e Uso Indicado

### Problema

Os badges de "Acao" (azul) e "Uso Indicado" (verde) usam cores claras (`text-blue-400`, `text-green-400`) que foram pensadas para fundo escuro (automotivo). No fundo branco dos produtos de limpeza, ficam quase invisiveis.

### Solucao

Ajustar as cores dos badges para serem condicionais ao `variant` do card:

| Badge | Fundo Escuro (automotivo) | Fundo Claro (limpeza) |
|-------|---------------------------|----------------------|
| Acao | `bg-blue-500/20 text-blue-400` | `bg-blue-100 text-blue-700` |
| Uso Indicado | `bg-green-500/20 text-green-400` | `bg-green-100 text-green-700` |
| PH | `bg-purple-500/20 text-purple-400` | `bg-purple-100 text-purple-700` |

### Arquivo a Modificar

`src/components/ProductCard.tsx` - linhas 226-244

### Detalhe Tecnico

Usar o prop `variant` que ja existe no componente para alternar as classes:

```tsx
// Antes (sempre claro)
<span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">

// Depois (condicional)
<span className={`text-xs px-2 py-0.5 rounded-full ${
  variant === 'automotive'
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-blue-100 text-blue-700'
}`}>
```

O mesmo padrao sera aplicado aos tres badges (azul, verde e roxo), garantindo boa legibilidade em ambos os fundos.

