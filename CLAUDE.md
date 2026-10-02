# CLAUDE.md — Ubadesklimp (Sistema Unificado)

## O que é este projeto

Sistema único cobrindo o site público da Ubadesklimp **e** o painel administrativo interno, unificados numa base de dados só. Antes existiam dois sistemas separados (site em Lovable + "Ubadesk Compras" isolado); a decisão foi fundir os dois.

## Decisão de arquitetura (ler antes de qualquer mudança estrutural)

- **Uma tabela de produtos só**, usada tanto pela vitrine pública do site quanto pelo módulo interno de compras/faltantes. Nunca duplicar cadastro de produto entre "site" e "compras".
- **[INVESTIGAR PRIMEIRO]** Determinar qual Supabase é a fonte da verdade: o site (Lovable) já tem seu próprio backend Supabase — antes de programar qualquer coisa, mapear a estrutura atual desse banco (tabelas de produto existentes, como o admin edita hoje) e decidir se o módulo de Compras migra pra dentro desse projeto, ou se é o contrário. Não assumir, perguntar/investigar e reportar antes de criar schema novo.
- O painel administrativo atual (feito em Lovable) está "muito vibecode" — simples demais, sem estrutura sólida. Não é só adicionar módulo novo; é refazer o painel administrativo com padrão de qualidade mais alto (ver seção de Design abaixo).

## Escopo do painel administrativo unificado

Navegação lateral (sidebar) com pelo menos:

1. **Início** — resumo rápido: itens faltando, quantos urgentes, vendas recentes
2. **Financeiro** — pedidos/vendas do site, clientes que compraram e fecharam via WhatsApp
3. **Produtos** — cadastro único, usado tanto na vitrine pública (frente de cliente) quanto no módulo de compras
4. **Faltantes/Compras** — módulo já especificado em detalhe no PRD do Ubadesk Compras (ver arquivo `PRD-Ubadesk-Compras.md` se disponível no repo/anexo): detecção de item faltante por IA (foto de lista manuscrita → transcrição → match com produto existente), cotação com fornecedores que vendem aquele produto, com mensagem pré-formatada tipo `wa.me/...`
5. **Fornecedores** — cadastro simples (nome, telefone/WhatsApp, e-mail)

## Permissões

Pelo menos 2 papéis:
- **Comprador** — acesso total, inclusive cotação e financeiro
- **Operacional** — só registra item faltante, sem ver preço nem financeiro

## Design (resumo — ver `Briefing-Design-Ubadesk-Compras.md` para detalhe completo)

- **Não usar o combo fundo creme + verde-menta genérico** — é o visual padrão de qualquer app gerado sem direção.
- Paleta: fundo `#F5F6F3`, tinta `#141B1E`, acento de marca `#0F6B5C` (verde-petróleo), selo Urgente `#C0392B`, selo Comprado `#2F9E44`, selo Pendente `#6B7280`.
- Tipografia: grotesca técnica pra labels/título (IBM Plex Sans ou Space Grotesk), Inter/Plex pro corpo, monoespaçada (IBM Plex Mono/JetBrains Mono) pra números e quantidades.
- Elemento de assinatura: badges de status tipo "carimbo/selo" (leve rotação, caixa alta, cor sólida forte) — remete à origem do produto (lista de papel → dado digital).
- Referências reais a seguir: **Linear** (tratamento de status/badge), **Sortly** (cartão de item mobile-first), **Bling** (navegação persistente + consistência entre telas de um ERP brasileiro).
- Navegação sempre visível (sidebar no desktop, barra inferior fixa no mobile) — nunca rodapé de link solto.
- Mobile é uso real (equipe usa no chão do estoque), não só responsivo: alvo de toque grande, teclado numérico automático em campo de quantidade, mínimo de scroll pra ações comuns.

## Skills e ferramentas recomendadas para este projeto

- **`/frontend-design`** (skill oficial do Claude Code) — usar sempre que for construir ou refazer tela de UI. Traz consciência de design system e evita padrão genérico. Instalar se ainda não estiver disponível na sessão.
- **MCP do Supabase** — usar para inspecionar/alterar schema real em vez de assumir estrutura de banco.
- Se este repositório ainda estiver conectado ao Lovable (herdado da criação original), avaliar com o usuário se vale manter essa conexão ou desacoplar — não desconectar sem confirmar antes.
- Ao gerar migrations, mantê-las organizadas e autocontidas por módulo (produtos, financeiro, faltantes, fornecedores), facilitando entender o histórico depois.

## Regras gerais de trabalho

- Ao encontrar decisão de arquitetura, custo, ou segurança não coberta aqui: **parar e perguntar**, não assumir.
- Este projeto pode futuramente virar SaaS vendido pra outros clientes — evitar decisões de estrutura de dados que seriam muito trabalhosas de generalizar depois (ex: nada assumindo que existe só uma empresa no sistema), mas sem construir multi-tenant agora.
- Nível de execução esperado: isso deve parecer um produto pronto pra usar todo dia, não uma prova de conceito. Se o resultado parecer "formulário simples", não está no nível esperado.
