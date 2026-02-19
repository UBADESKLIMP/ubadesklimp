

## Adicionar "Acao" e "Uso Indicado" nos Produtos de Limpeza

---

### O que sera feito

Os campos **Acao** e **Uso Indicado** (que ja existem no banco de dados como `action_type` e `application_area`) serao disponibilizados tambem para produtos de limpeza, com labels adaptados ao contexto.

---

### Alteracoes

#### 1. `src/components/ProductForm.tsx`

Mover os campos "Acao" e "Local de Aplicacao" para **fora** do bloco condicional `lineType === 'automotivo'`, criando uma secao de detalhes tecnicos que aparece para ambas as linhas:

- **Para limpeza**: mostrar "Acao" (ex: Desengordurante, Bactericida) e "Uso Indicado" (ex: Cozinha, Banheiro, Pisos)
- **Para automotivo**: manter como esta (Acao, PH, Local de Aplicacao, Marca)
- Os campos de Marca e PH continuam exclusivos para automotivo

#### 2. `src/components/ProductCard.tsx`

Os badges de acao/uso indicado ja sao renderizados para qualquer produto que tenha esses campos preenchidos (linha 226-244). **Nenhuma alteracao necessaria** - ja funciona automaticamente.

#### 3. `src/components/ProductDetailModal.tsx`

A secao "Detalhes Tecnicos" (linha 417-441) ja exibe para qualquer produto com esses campos. Ajustar o label:
- Renomear de "Detalhes Tecnicos" (generico) ao inves de manter "Detalhes Tecnicos Automotivos"
- Renomear "Local de Aplicacao" para "Uso Indicado" quando for produto de limpeza

---

### Resultado

| Antes | Depois |
|-------|--------|
| Campos de Acao/Uso so apareciam no formulario de produtos automotivos | Aparecem para ambas as linhas |
| Cards de limpeza nao mostravam badges tecnicos | Mostram badges de Acao e Uso Indicado quando preenchidos |
| Modal mostrava "Detalhes Tecnicos Automotivos" | Mostra "Detalhes Tecnicos" de forma generica |

