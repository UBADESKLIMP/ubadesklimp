import React, { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { User, Building, Save, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { profile, loading, updateProfile } = useProfile();
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    email: profile?.email || '',
    person_type: profile?.person_type || 'pf',
    cpf: profile?.cpf || '',
    company_name: profile?.company_name || '',
    trade_name: profile?.trade_name || '',
    cnpj: profile?.cnpj || '',
    state_registration: profile?.state_registration || '',
    delivery_address: profile?.delivery_address || '',
    billing_email: profile?.billing_email || '',
    contact_phone: profile?.contact_phone || '',
    notes: profile?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        person_type: profile.person_type || 'pf',
        cpf: profile.cpf || '',
        company_name: profile.company_name || '',
        trade_name: profile.trade_name || '',
        cnpj: profile.cnpj || '',
        state_registration: profile.state_registration || '',
        delivery_address: profile.delivery_address || '',
        billing_email: profile.billing_email || '',
        contact_phone: profile.contact_phone || '',
        notes: profile.notes || '',
      });
    }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(formData);
    } catch (error) {
      // Error handled in hook
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-pulse text-foreground">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pt-20 pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao início
          </Link>
          <h1 className="text-3xl font-heading text-gradient mb-2">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Configure seus dados pessoais e informações de entrega.
          </p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Complete seu cadastro para facilitar futuros pedidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={formData.person_type} onValueChange={(value) => handleChange('person_type', value)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pf" className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  Pessoa Física
                </TabsTrigger>
                <TabsTrigger value="pj" className="flex items-center">
                  <Building className="h-4 w-4 mr-2" />
                  Pessoa Jurídica
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pf" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => handleChange('cpf', e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Telefone para Contato</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_email">Email para Cobrança</Label>
                    <Input
                      id="billing_email"
                      type="email"
                      value={formData.billing_email}
                      onChange={(e) => handleChange('billing_email', e.target.value)}
                      placeholder="cobranca@email.com"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pj" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Razão Social *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="trade_name">Nome Fantasia</Label>
                    <Input
                      id="trade_name"
                      value={formData.trade_name}
                      onChange={(e) => handleChange('trade_name', e.target.value)}
                      placeholder="Nome fantasia"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => handleChange('cnpj', e.target.value)}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_registration">Inscrição Estadual</Label>
                    <Input
                      id="state_registration"
                      value={formData.state_registration}
                      onChange={(e) => handleChange('state_registration', e.target.value)}
                      placeholder="IE (Se Houver)"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone_pj">Telefone para Contato</Label>
                    <Input
                      id="contact_phone_pj"
                      value={formData.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_email_pj">Email para Cobrança</Label>
                    <Input
                      id="billing_email_pj"
                      type="email"
                      value={formData.billing_email}
                      onChange={(e) => handleChange('billing_email', e.target.value)}
                      placeholder="cobranca@empresa.com"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <Separator className="my-6" />

            {/* Common fields */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="delivery_address">Endereço para Entrega</Label>
                <Textarea
                  id="delivery_address"
                  value={formData.delivery_address}
                  onChange={(e) => handleChange('delivery_address', e.target.value)}
                  placeholder="Rua, número, complemento, bairro, cidade, CEP"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Ex: fechado para horário de almoço: 12:00-14:00, Deixar entrega com EX:Caseiro Bruno."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-gradient-primary hover:shadow-glow"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Perfil'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;