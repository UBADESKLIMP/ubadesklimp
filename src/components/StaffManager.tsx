import { useState } from 'react';
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
  isAdmin: boolean;
  permissions: Set<StaffPermission>;
}

const emptyForm = (): StaffFormState => ({
  username: '',
  password: '',
  displayName: '',
  isAdmin: false,
  permissions: new Set(),
});

const StaffManager = () => {
  const { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember } = useStaffMembers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<StaffFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<Set<StaffPermission>>(new Set());
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  const togglePermission = (set: Set<StaffPermission>, permission: StaffPermission): Set<StaffPermission> => {
    const next = new Set(set);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    return next;
  };

  const handleCreate = async () => {
    if (!createForm.username || !createForm.password || createForm.password.length < 8) return;
    setIsSubmitting(true);
    try {
      await createStaffMember({
        username: createForm.username,
        password: createForm.password,
        displayName: createForm.displayName || undefined,
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
  };

  const saveEditing = async () => {
    if (!editingUserId) return;
    await updatePermissions(editingUserId, editIsAdmin, Array.from(editPermissions));
    setEditingUserId(null);
  };

  const handleDelete = async (member: StaffMember) => {
    if (!window.confirm(`Excluir o funcionário "${member.display_name}"? Essa ação não pode ser desfeita.`)) return;
    await deleteStaffMember(member.user_id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Funcionários
        </CardTitle>
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
                <Label htmlFor="staff-password">Senha</Label>
                <Input
                  id="staff-password"
                  type="text"
                  placeholder="mínimo 8 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
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
                disabled={isSubmitting || !createForm.username || !createForm.password || createForm.password.length < 8}
              >
                {isSubmitting ? 'Criando...' : 'Criar funcionário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : staffMembers.length === 0 ? (
          <p className="text-muted-foreground">Nenhum funcionário cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {staffMembers.map((member) => (
              <div key={member.user_id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{member.display_name}</p>
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
                    <Button variant="outline" size="icon" onClick={() => handleDelete(member)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingUserId === member.user_id && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-is-admin-${member.user_id}`}
                        checked={editIsAdmin}
                        onCheckedChange={(checked) => setEditIsAdmin(checked === true)}
                      />
                      <Label htmlFor={`edit-is-admin-${member.user_id}`}>É administrador (acesso total)</Label>
                    </div>
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
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing}>
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingUserId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StaffManager;
