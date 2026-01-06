import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import WhatsAppIcon from './WhatsAppIcon';
import { orderSchema } from '@/lib/validations';
import { z } from 'zod';

interface OrderFormData {
  name: string;
  notes?: string;
}

interface OrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderFormData) => void;
  loading?: boolean;
}

const OrderForm: React.FC<OrderFormProps> = ({ isOpen, onClose, onSubmit, loading = false }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Get initial name from profile or user
  const getInitialName = () => {
    if (profile?.name) return profile.name;
    if (profile?.company_name) return profile.company_name;
    if (profile?.trade_name) return profile.trade_name;
    return '';
  };
  
  const [formData, setFormData] = useState<OrderFormData>({
    name: getInitialName(),
    notes: ''
  });

  // Update form when profile loads - only set name if it's empty or profile changes
  React.useEffect(() => {
    const profileName = profile?.name || profile?.company_name || profile?.trade_name || '';
    if (profileName) {
      setFormData(prev => ({
        ...prev,
        name: profileName
      }));
    }
  }, [profile?.name, profile?.company_name, profile?.trade_name]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    
    // Validar inputs
    try {
      orderSchema.parse({ name: formData.name, notes: formData.notes });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setValidationErrors(errors);
        return;
      }
    }
    
    onSubmit(formData);
  };

  const handleChange = (field: keyof OrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <WhatsAppIcon className="w-5 h-5 text-green-600" />
            <span>Finalizar Pedido</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Seu nome completo"
              required
            />
            {validationErrors.name && (
              <p className="text-sm text-destructive">{validationErrors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Alguma observação especial para seu pedido..."
              rows={3}
            />
            {validationErrors.notes && (
              <p className="text-sm text-destructive">{validationErrors.notes}</p>
            )}
          </div>

          {!user && (
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              💡 Crie uma conta para salvar seus dados e ver o histórico de pedidos!
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={loading || !formData.name}
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <WhatsAppIcon className="w-4 h-4" />
                  <span>Enviar Pedido</span>
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderForm;