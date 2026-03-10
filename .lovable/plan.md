

## Ajuste de Espaçamento dos Badges

### Problema
O badge azul (e os demais) está com padding muito apertado (`px-2 py-0.5`), fazendo o fundo parecer torto/desalinhado em relação ao texto.

### Solução
Aumentar o padding de todos os três badges de `px-2 py-0.5` para `px-2.5 py-1`, garantindo espaçamento uniforme e visual mais equilibrado.

### Arquivo a Modificar
`src/components/ProductCard.tsx` - linhas 229, 238 e 247

### Detalhe
Trocar `px-2 py-0.5` por `px-2.5 py-1` nos três badges (Ação, Uso Indicado e PH), mantendo todo o resto igual.

