
## Ajuste: Posição de Compra Sempre Abaixo da Foto

---

### O que será feito

A posição do botão "Comprar Agora", preço e seleções de variação/fragrância será **sempre abaixo da foto do produto** no modal de detalhes, eliminando a configuração manual `price_position`.

---

### Alterações

#### 1. `src/components/ProductDetailModal.tsx`

| Linha | Alteração |
|-------|-----------|
| 23 | Remover a variável `showButtonBelowImage` |
| 279-371 | Manter esta seção (abaixo da imagem) |
| 450-544 | Remover esta seção duplicada (abaixo do texto) |

A seção de compra ficará **sempre abaixo da imagem**, sem condicionais.

---

#### 2. `src/components/ProductForm.tsx` (Opcional - Limpeza)

Remover o campo `price_position` do formulário de administração, já que não será mais necessário:
- Remover o select de "Posição do Preço/Botão" (aba Detalhes)
- Manter o campo `price_position` nos dados por compatibilidade, mas não exibi-lo

---

### Resultado

- **Antes**: Configuração manual onde o admin escolhia entre "Abaixo da imagem" ou "Abaixo do texto"
- **Depois**: Botão de compra, preço e variações **sempre** aparecem abaixo da foto, sem configuração necessária
