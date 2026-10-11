import { useCallback, useMemo, useRef, useState } from 'react';
import EquipeFuncionarioFields from '@/components/equipe/EquipeFuncionarioFields';
import { Plus, Trash2, Shield, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useStaffMembers, StaffMember } from '@/hooks/useStaffMembers';
import { StaffPermission } from '@/hooks/useStaffAccess';
import { toast } from '@/hooks/use-toast';
import {
  funcoesConhecidas,
  normalizarFuncao,
  permissoesSugeridas,
} from '@/lib/funcoesDaEquipe';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';

/** Uma lista só para todos os campos de função da tela. */
const LISTA_DE_FUNCOES = 'funcoes-da-equipe';

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  faltantes: 'Faltantes',
  produtos: 'Produtos',
  fornecedores: 'Fornecedores',
  financeiro: 'Financeiro',
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as StaffPermission[];

interface StaffFormState {
  username: string;
  password: string;
  displayName: string;
  cargo: string;
  isAdmin: boolean;
  permissions: Set<StaffPermission>;
}

const emptyForm = (): StaffFormState => ({
  username: '',
  password: '',
  displayName: '',
  cargo: '',
  isAdmin: false,
  permissions: new Set(),
});

const StaffManager = () => {
  const { staffMembers, loading, createStaffMember, updatePermissions, updatePerfil, changePassword, deleteStaffMember } =
    useStaffMembers();
  const adminCount = staffMembers.filter((m) => m.is_admin).length;

  // As sugeridas mais as que já estão em uso: digitou uma vez, vira opção.
  const funcoes = useMemo(
    () => funcoesConhecidas(staffMembers.map((m) => m.cargo)),
    [staffMembers]
  );

  // Administradores em cima: são poucos, mudam pouco e é quem se procura
  // primeiro quando algo está errado. Dentro de cada grupo, ordem alfabética.
  const membrosOrdenados = [...staffMembers].sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
    return a.display_name.localeCompare(b.display_name, 'pt-BR');
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StaffFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<StaffPermission>>(new Set());
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // O bloco de Equipe entrega aqui o próprio salvamento, pra existir um botão
  // "Salvar" só na tela em vez de dois que gravam metades diferentes.
  const salvarEquipeRef = useRef<(() => Promise<boolean>) | null>(null);
  const registrarSalvarEquipe = useCallback((salvar: () => Promise<boolean>) => {
    salvarEquipeRef.current = salvar;
  }, []);

  const togglePermission = (set: Set<StaffPermission>, permission: StaffPermission): Set<StaffPermission> => {
    const next = new Set(set);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    return next;
  };

  const handleCreate = async () => {
    if (!createForm.username || !/^\d{4}$/.test(createForm.password)) return;
    setIsSubmitting(true);
    try {
      await createStaffMember({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName || undefined,
        cargo: normalizarFuncao(createForm.cargo, funcoes) || undefined,
        isAdmin: createForm.isAdmin,
        permissions: Array.from(createForm.permissions),
      });
      setCreateForm(emptyForm());
      setIsCreateOpen(false);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (member: StaffMember) => {
    setEditingUserId(member.user_id);
    setEditIsAdmin(member.is_admin);
    setEditPermissions(new Set(member.permissions));
    setEditDisplayName(member.display_name);
    setEditCargo(member.cargo ?? '');
    setEditNewPassword('');
    salvarEquipeRef.current = null;
  };

  const saveEditing = async () => {
    if (!editingUserId) return;
    setIsSavingProfile(true);
    try {
      const trimmedName = editDisplayName.trim();
      await updatePermissions(editingUserId, editIsAdmin, Array.from(editPermissions));
      await updatePerfil(editingUserId, {
        displayName: trimmedName || undefined,
        cargo: normalizarFuncao(editCargo, funcoes),
      });

      // Os campos de Equipe avisam sozinhos quando falham, e o que já foi
      // gravado acima continua gravado — por isso não desfaz nem esconde o erro.
      const equipeOk = salvarEquipeRef.current ? await salvarEquipeRef.current() : true;
      if (!equipeOk) return;

      toast({ title: 'Funcionário salvo' });
      setEditingUserId(null);
    } catch {
      // erro já mostrado via toast dentro dos hooks
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editingUserId || !/^\d{4}$/.test(editNewPassword)) return;
    setIsChangingPassword(true);
    try {
      await changePassword(editingUserId, editNewPassword);
      setEditNewPassword('');
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDelete = async (member: StaffMember) => {
    if (!window.confirm(`Excluir o funcionário "${member.display_name}"? Essa ação não pode ser desfeita.`)) return;
    await deleteStaffMember(member.user_id);
  };

  return (
    <Card>
      {/* Uma lista só, usada pelo campo de função do cadastro e de cada edição. */}
      <datalist id={LISTA_DE_FUNCOES}>
        {funcoes.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg">
        <AdminPageHeader
          icon={Shield}
          title="Funcionários"
          description="Crie contas de funcionário e defina o que cada um pode acessar."
          action={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setCreateForm(emptyForm())}>
              <Plus className="h-4 w-4 mr-2" />
              Novo funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo funcionário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff-username">Nome de usuário</Label>
                <Input
                  id="staff-username"
                  placeholder="leticia"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Senha (4 dígitos)</Label>
                <Input
                  id="staff-password"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="0000"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, password: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-display-name">Nome de exibição (opcional)</Label>
                <Input
                  id="staff-display-name"
                  placeholder="Letícia"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-cargo">Função</Label>
                <Input
                  id="staff-cargo"
                  list={LISTA_DE_FUNCOES}
                  placeholder="Entregador"
                  value={createForm.cargo}
                  onChange={(e) => {
                    const cargo = e.target.value;
                    const sugestao = permissoesSugeridas(cargo);
                    setCreateForm((f) => ({
                      ...f,
                      cargo,
                      // Cadastro novo não tem nada a perder: a função já deixa
                      // as caixas prováveis marcadas e quem cadastra corrige.
                      permissions: sugestao ? new Set(sugestao) : f.permissions,
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  O que a pessoa faz na loja. Serve de etiqueta e sugere as permissões abaixo — não
                  manda nelas. Pode escrever uma função que não está na lista.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="staff-is-admin"
                  checked={createForm.isAdmin}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, isAdmin: checked === true }))
                  }
                />
                <Label htmlFor="staff-is-admin">É administrador (acesso total)</Label>
              </div>
              {!createForm.isAdmin && (
                <div className="space-y-2">
                  <Label>Permissões</Label>
                  {ALL_PERMISSIONS.map((permission) => (
                    <div key={permission} className="flex items-center gap-2">
                      <Checkbox
                        id={`staff-perm-${permission}`}
                        checked={createForm.permissions.has(permission)}
                        onCheckedChange={() =>
                          setCreateForm((f) => ({ ...f, permissions: togglePermission(f.permissions, permission) }))
                        }
                      />
                      <Label htmlFor={`staff-perm-${permission}`}>{PERMISSION_LABELS[permission]}</Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !createForm.username || !/^\d{4}$/.test(createForm.password)}
              >
                {isSubmitting ? 'Criando...' : 'Criar funcionário'}
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : staffMembers.length === 0 ? (
          <AdminEmptyState icon={Shield} title="Nenhum funcionário cadastrado ainda." tone="light" />
        ) : (
          <div className="space-y-3">
            {membrosOrdenados.map((member, i) => (
              <div key={member.user_id}>
              {/* Uma linha separa os dois grupos, pra não parecer lista única. */}
              {i > 0 && !member.is_admin && membrosOrdenados[i - 1].is_admin && (
                <p className="text-xs uppercase tracking-wider text-muted-foreground pt-4 pb-2">
                  Funcionários
                </p>
              )}
              {i === 0 && member.is_admin && (
                <p className="text-xs uppercase tracking-wider text-muted-foreground pb-2">
                  Administradores
                </p>
              )}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {member.display_name}
                      {member.cargo && (
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {member.cargo}
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {member.is_admin ? (
                        <Badge>Administrador</Badge>
                      ) : member.permissions.length === 0 ? (
                        <Badge variant="outline">Sem permissões</Badge>
                      ) : (
                        member.permissions.map((permission) => (
                          <Badge key={permission} variant="outline">
                            {PERMISSION_LABELS[permission]}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => startEditing(member)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(member)}
                      disabled={member.is_admin && adminCount <= 1}
                      title={member.is_admin && adminCount <= 1 ? 'Não é possível excluir o último administrador' : undefined}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingUserId === member.user_id && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-display-name-${member.user_id}`}>Nome de exibição</Label>
                      <Input
                        id={`edit-display-name-${member.user_id}`}
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-cargo-${member.user_id}`}>Função</Label>
                      <Input
                        id={`edit-cargo-${member.user_id}`}
                        list={LISTA_DE_FUNCOES}
                        placeholder="Sem função definida"
                        value={editCargo}
                        onChange={(e) => setEditCargo(e.target.value)}
                      />
                      {/* Em quem já existe a sugestão nunca mexe sozinha: trocar
                          permissão de quem já trabalha é mudança de acesso, e
                          isso é escolha de quem está olhando a tela. */}
                      {!editIsAdmin &&
                        (() => {
                          const sugestao = permissoesSugeridas(editCargo);
                          if (!sugestao) return null;
                          const iguais =
                            sugestao.length === editPermissions.size &&
                            sugestao.every((p) => editPermissions.has(p));
                          if (iguais) return null;
                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-muted-foreground">
                                {sugestao.length === 0
                                  ? 'Esta função normalmente não precisa de nenhuma permissão de painel.'
                                  : `Esta função normalmente usa: ${sugestao
                                      .map((p) => PERMISSION_LABELS[p])
                                      .join(', ')}.`}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditPermissions(new Set(sugestao))}
                              >
                                Usar essas
                              </Button>
                            </div>
                          );
                        })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-is-admin-${member.user_id}`}
                        checked={editIsAdmin}
                        disabled={member.is_admin && adminCount <= 1}
                        onCheckedChange={(checked) => setEditIsAdmin(checked === true)}
                      />
                      <Label htmlFor={`edit-is-admin-${member.user_id}`}>É administrador (acesso total)</Label>
                    </div>
                    {member.is_admin && adminCount <= 1 && (
                      <p className="text-sm text-muted-foreground">
                        Este é o único administrador — não é possível remover a permissão de admin dele por aqui.
                      </p>
                    )}
                    {!editIsAdmin && (
                      <div className="space-y-2">
                        {ALL_PERMISSIONS.map((permission) => (
                          <div key={permission} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-perm-${member.user_id}-${permission}`}
                              checked={editPermissions.has(permission)}
                              onCheckedChange={() =>
                                setEditPermissions((prev) => togglePermission(prev, permission))
                              }
                            />
                            <Label htmlFor={`edit-perm-${member.user_id}-${permission}`}>
                              {PERMISSION_LABELS[permission]}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="border-t pt-3 space-y-2">
                      <Label htmlFor={`edit-password-${member.user_id}`}>Alterar senha (novo PIN de 4 dígitos)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`edit-password-${member.user_id}`}
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          placeholder="0000"
                          value={editNewPassword}
                          onChange={(e) => setEditNewPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleChangePassword}
                          disabled={isChangingPassword || !/^\d{4}$/.test(editNewPassword)}
                        >
                          {isChangingPassword ? 'Salvando...' : 'Salvar nova senha'}
                        </Button>
                      </div>
                    </div>
                    <EquipeFuncionarioFields
                      userId={member.user_id}
                      onRegistrarSalvar={registrarSalvarEquipe}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing} disabled={isSavingProfile}>
                        {isSavingProfile ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffManager;
