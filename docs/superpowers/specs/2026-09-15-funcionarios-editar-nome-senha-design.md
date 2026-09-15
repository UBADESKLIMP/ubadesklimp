# Funcionários — editar nome de exibição e alterar senha — Spec

## Contexto

O cadastro de funcionário (`supabase/functions/criar-funcionario`,
`StaffManager.tsx`) só permite definir nome de exibição e senha (PIN de 4 dígitos)
na criação. Não existe forma de corrigir depois — inclusive a própria conta admin
do dono ficou com `display_name = 'admin'` (valor de fallback de uma migração
antiga) sem jeito de trocar. Senha também não tem forma de redefinir se o
funcionário esquecer o PIN.

Senha de funcionário é hash no Supabase Auth — não existe "ver a senha atual"
(nenhum sistema sério guarda senha reversível). O que resolve o pedido de "ver
senha" é poder redefinir e ver o PIN novo em texto claro no momento em que é
digitado, igual já acontece hoje no formulário de criação.

## Desenho

No painel de edição de um funcionário já existente em `StaffManager.tsx` (hoje só
tem toggle de admin/permissões), adicionar:

### Campo "Nome de exibição"

Input de texto, valor inicial = `display_name` atual. Salvar faz
`update staff_members set display_name = ... where user_id = ...` — RLS já permite
(`Admins podem gerenciar staff_members`, policy `for all`), não precisa de Edge
Function nova. Mesma validação da criação: 1-100 caracteres, trim.

### Seção "Alterar senha"

Input de PIN novo (4 dígitos, `type="text"`, `inputMode="numeric"`, sem mascarar —
mesmo padrão do campo de senha na criação) + botão "Salvar nova senha".

Nova Edge Function `alterar-senha-funcionario`, mesmo esqueleto de auth/autorização
de `criar-funcionario` (valida JWT do chamador, confere `is_admin` via service
role antes de agir):

- Recebe `{ userId: string, newPassword: string }`.
- Valida `newPassword` com `/^\d{4}$/` (mesma regra da criação).
- `adminClient.auth.admin.updateUserById(userId, { password: newPassword +
  STAFF_PIN_SUFFIX })` — mesmo sufixo (`"-pin"`) já usado em
  `criar-funcionario`/`AuthContext.tsx`, obrigatório pra bater com a senha real na
  hora do login.
- Retorna sucesso/erro; UI mostra toast e limpa o campo.

## Fora de escopo

- Recuperar/mostrar a senha atual (impossível, hash).
- Funcionário trocar a própria senha sem passar por um admin.
- Histórico de quem trocou a senha de quem.

## Testes

Verificação manual:

- `npm run typecheck` limpo.
- Editar nome de exibição da própria conta admin (hoje "admin") — reflete na tela
  e em qualquer lugar que usa `useCurrentStaffName` (ex: "relatado por" em
  Faltantes).
- Trocar PIN de um funcionário, deslogar e logar de novo com o PIN novo —
  funciona; PIN antigo para de funcionar.
- Tentar trocar senha como usuário não-admin — Edge Function recusa (403), mesmo
  padrão de `criar-funcionario`.
