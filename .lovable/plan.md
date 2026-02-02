

## Remoção da Ferramenta de Remoção de Fundo

---

### O que será removido

A ferramenta de remoção de fundo com IA que estava na aba "Ferramentas" do painel administrativo.

---

### Arquivos a Excluir

| Arquivo | Motivo |
|---------|--------|
| `src/lib/backgroundRemoval.ts` | Lógica da funcionalidade |
| `src/components/BackgroundRemover.tsx` | Componente da interface |

---

### Arquivo a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Admin.tsx` | Remover import do `BackgroundRemover`, remover a aba "Ferramentas" e remover o `TabsContent` correspondente |

---

### Detalhes da Modificação em Admin.tsx

1. Remover a linha de import:
   ```typescript
   import BackgroundRemover from '@/components/BackgroundRemover';
   ```

2. Remover a aba "Ferramentas":
   ```tsx
   <TabsTrigger value="tools" ...>
     <Wand2 className="h-4 w-4" />
     <span>Ferramentas</span>
   </TabsTrigger>
   ```

3. Remover o conteúdo da aba:
   ```tsx
   <TabsContent value="tools">
     <div className="max-w-2xl mx-auto">
       <BackgroundRemover />
     </div>
   </TabsContent>
   ```

4. Remover o import do ícone `Wand2` se não for usado em outro lugar

---

### Resultado

- A aba "Ferramentas" será removida do painel admin
- Os arquivos da funcionalidade serão excluídos
- A dependência `@huggingface/transformers` pode ser removida do `package.json` se desejar (opcional)

