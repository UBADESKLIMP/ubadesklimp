import { useState } from 'react';
import { Plus, Trash2, Pencil, Truck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSuppliers, Supplier, SupplierInput } from '@/hooks/useSuppliers';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { normalizeText } from '@/lib/utils';

interface SupplierFormState {
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  avgDeliveryDays: string;
  maxInstallments: string;
  notes: string;
}

const emptyForm = (): SupplierFormState => ({
  contactName: '',
  companyName: '',
  phone: '',
  email: '',
  avgDeliveryDays: '',
  maxInstallments: '',
  notes: '',
});

// wa.me exige o número com código do país; se quem digitou já colocou 55 na
// frente mantemos, senão prefixamos — sem isso o link abre "número inválido".
const buildWhatsAppLink = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  const hasCountryCode = digits.length === 12 || digits.length === 13;
  const withCountryCode = hasCountryCode ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
};

const toNullableInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
};

const formToInput = (form: SupplierFormState): SupplierInput => ({
  contact_name: form.contactName.trim(),
  company_name: form.companyName.trim(),
  phone: form.phone.trim(),
  email: form.email.trim() || null,
  avg_delivery_days: toNullableInt(form.avgDeliveryDays),
  max_installments: toNullableInt(form.maxInstallments),
  notes: form.notes.trim() || null,
});

const isFormValid = (form: SupplierFormState) =>
  form.contactName.trim().length > 0 && form.companyName.trim().length > 0 && form.phone.trim().length > 0;

interface SupplierFormFieldsProps {
  form: SupplierFormState;
  onChange: (updater: (form: SupplierFormState) => SupplierFormState) => void;
  idPrefix: string;
}

const SupplierFormFields = ({ form, onChange, idPrefix }: SupplierFormFieldsProps) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-contact-name`}>Nome do contato</Label>
      <Input
        id={`${idPrefix}-contact-name`}
        placeholder="Maria"
        value={form.contactName}
        onChange={(e) => onChange((f) => ({ ...f, contactName: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-company-name`}>Empresa</Label>
      <Input
        id={`${idPrefix}-company-name`}
        placeholder="Distribuidora ABC"
        value={form.companyName}
        onChange={(e) => onChange((f) => ({ ...f, companyName: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-phone`}>Telefone/WhatsApp</Label>
      <Input
        id={`${idPrefix}-phone`}
        placeholder="(12) 99999-9999"
        value={form.phone}
        onChange={(e) => onChange((f) => ({ ...f, phone: e.target.value }))}
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-email`}>E-mail (opcional)</Label>
      <Input
        id={`${idPrefix}-email`}
        type="email"
        placeholder="contato@empresa.com"
        value={form.email}
        onChange={(e) => onChange((f) => ({ ...f, email: e.target.value }))}
      />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-avg-delivery`}>Prazo médio de entrega (dias)</Label>
        <Input
          id={`${idPrefix}-avg-delivery`}
          type="number"
          min="0"
          placeholder="5"
          value={form.avgDeliveryDays}
          onChange={(e) => onChange((f) => ({ ...f, avgDeliveryDays: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-max-installments`}>Parcela em até (vezes)</Label>
        <Input
          id={`${idPrefix}-max-installments`}
          type="number"
          min="1"
          placeholder="3"
          value={form.maxInstallments}
          onChange={(e) => onChange((f) => ({ ...f, maxInstallments: e.target.value }))}
        />
      </div>
    </div>
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-notes`}>Observações (opcional)</Label>
      <Textarea
        id={`${idPrefix}-notes`}
        placeholder="Observações sobre esse fornecedor"
        value={form.notes}
        onChange={(e) => onChange((f) => ({ ...f, notes: e.target.value }))}
      />
    </div>
  </div>
);

const SupplierManager = () => {
  const { suppliers, loading, createSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SupplierFormState>(emptyForm());
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredSuppliers = suppliers.filter((supplier) => {
    const normalizedSearch = normalizeText(searchTerm);
    return (
      normalizeText(supplier.contact_name).includes(normalizedSearch) ||
      normalizeText(supplier.company_name).includes(normalizedSearch)
    );
  });

  const handleCreate = async () => {
    if (!isFormValid(createForm)) return;
    setIsSubmitting(true);
    try {
      await createSupplier(formToInput(createForm));
      setCreateForm(emptyForm());
      setIsCreateOpen(false);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setEditForm({
      contactName: supplier.contact_name,
      companyName: supplier.company_name,
      phone: supplier.phone,
      email: supplier.email || '',
      avgDeliveryDays: supplier.avg_delivery_days?.toString() || '',
      maxInstallments: supplier.max_installments?.toString() || '',
      notes: supplier.notes || '',
    });
  };

  const saveEditing = async () => {
    if (!editingId || !isFormValid(editForm) || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await updateSupplier(editingId, formToInput(editForm));
      setEditingId(null);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (deletingId) return;
    if (
      !window.confirm(
        `Excluir o fornecedor "${supplier.contact_name}" (${supplier.company_name})? Essa ação não pode ser desfeita e também apaga o histórico de cotações desse fornecedor (preços e arquivos enviados).`
      )
    )
      return;
    setDeletingId(supplier.id);
    try {
      await deleteSupplier(supplier.id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={Truck}
          title="Fornecedores"
          description="Cadastre os fornecedores e abra o WhatsApp deles direto por aqui."
          action={
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setCreateForm(emptyForm())}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo fornecedor
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo fornecedor</DialogTitle>
                </DialogHeader>
                <SupplierFormFields form={createForm} onChange={setCreateForm} idPrefix="create" />
                <DialogFooter>
                  <Button onClick={handleCreate} disabled={isSubmitting || !isFormValid(createForm)}>
                    {isSubmitting ? 'Criando...' : 'Criar fornecedor'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm bg-white"
        />
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : suppliers.length === 0 ? (
          <AdminEmptyState icon={Truck} title="Nenhum fornecedor cadastrado ainda." tone="light" />
        ) : filteredSuppliers.length === 0 ? (
          <AdminEmptyState icon={Truck} title="Nenhum fornecedor encontrado" description="Tente ajustar a busca" tone="light" />
        ) : (
          <div className="space-y-3">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{supplier.contact_name}</p>
                    <p className="text-sm text-muted-foreground">{supplier.company_name}</p>
                    <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                    {(supplier.avg_delivery_days != null || supplier.max_installments != null) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {supplier.avg_delivery_days != null && `Entrega em ~${supplier.avg_delivery_days} dias`}
                        {supplier.avg_delivery_days != null && supplier.max_installments != null && ' · '}
                        {supplier.max_installments != null && `Até ${supplier.max_installments}x`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="icon" asChild>
                      <a href={buildWhatsAppLink(supplier.phone)} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Editar fornecedor"
                      onClick={() => startEditing(supplier)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Excluir fornecedor"
                      disabled={deletingId === supplier.id}
                      onClick={() => handleDelete(supplier)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingId === supplier.id && (
                  <div className="border-t pt-3 space-y-3">
                    <SupplierFormFields form={editForm} onChange={setEditForm} idPrefix={`edit-${supplier.id}`} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditing} disabled={isSavingEdit || !isFormValid(editForm)}>
                        {isSavingEdit ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={isSavingEdit}>
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

export default SupplierManager;
