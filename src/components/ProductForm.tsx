
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Loader2, Star } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductVariationsManager from './ProductVariationsManager';

interface ProductFormProps {
  product?: ProductWithVariations | null;
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
}

const ProductForm = ({ product, onSave, onCancel }: ProductFormProps) => {
  const { uploadImage, uploading } = useImageUpload();
  const { categories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    category: product?.category || '',
    image_url: product?.image_url || '',
    priority: product?.priority || false,
    priority_order: product?.priority_order || 0,
    has_variations: product?.has_variations || false,
    material: product?.material || '',
    validity: product?.validity || '',
    specifications: product?.specifications || ''
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || (!formData.has_variations && !formData.price) || !formData.category) {
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price: formData.has_variations ? null : parseFloat(formData.price || '0'),
        category: formData.category,
        image_url: formData.image_url || null,
        priority: formData.priority,
        priority_order: formData.priority_order,
        has_variations: formData.has_variations,
        material: formData.material || null,
        validity: formData.validity || null,
        specifications: formData.specifications || null
      };

      await onSave(productData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="variations">Variações</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Produto *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Descrição Resumida</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  placeholder="Descrição que aparecerá no card do produto"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="image">Imagem Principal</Label>
                <div className="space-y-2">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Fazendo upload...</span>
                    </div>
                  )}
                  {formData.image_url && (
                    <div className="mt-2">
                      <img 
                        src={formData.image_url} 
                        alt="Preview" 
                        className="w-20 h-20 object-contain rounded border bg-muted/50"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações de Prioridade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                <Star className="h-5 w-5 text-yellow-500" />
                <Label htmlFor="priority" className="font-medium">Item Prioritário</Label>
                <Switch
                  id="priority"
                  checked={formData.priority}
                  onCheckedChange={(checked) => setFormData({...formData, priority: checked})}
                />
                <span className="text-sm text-muted-foreground ml-2">
                  {formData.priority ? 'Aparecerá no topo da lista' : 'Posição normal na lista'}
                </span>
              </div>

              {formData.priority && (
                <div>
                  <Label htmlFor="priority_order">Ordem de Prioridade</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="priority_order"
                      type="number"
                      min="0"
                      value={formData.priority_order}
                      onChange={(e) => setFormData({...formData, priority_order: parseInt(e.target.value) || 0})}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Menor número = maior prioridade
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Especificações Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  value={formData.material}
                  onChange={(e) => setFormData({...formData, material: e.target.value})}
                  placeholder="Ex: Plástico PET, Vidro, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="validity">Validade</Label>
                <Input
                  id="validity"
                  value={formData.validity}
                  onChange={(e) => setFormData({...formData, validity: e.target.value})}
                  placeholder="Ex: 12 meses, 24 meses"
                />
              </div>
              
              <div>
                <Label htmlFor="specifications">Especificações Detalhadas</Label>
                <Textarea
                  id="specifications"
                  value={formData.specifications}
                  onChange={(e) => setFormData({...formData, specifications: e.target.value})}
                  rows={4}
                  placeholder="Descrição completa do produto, modo de uso, benefícios, etc."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="variations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Variações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                <Label htmlFor="has_variations" className="font-medium">Produto possui variações de litragem</Label>
                <Switch
                  id="has_variations"
                  checked={formData.has_variations}
                  onCheckedChange={(checked) => setFormData({...formData, has_variations: checked})}
                />
              </div>

              {!formData.has_variations && (
                <div>
                  <Label htmlFor="price">Preço Único (R$) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    placeholder="15.90"
                    required={!formData.has_variations}
                  />
                </div>
              )}

              {formData.has_variations && product?.id && (
                <div className="border-t pt-4">
                  <ProductVariationsManager
                    productId={product.id}
                    onVariationsChange={() => {
                      // Callback para atualizar se necessário
                    }}
                  />
                </div>
              )}

              {formData.has_variations && !product?.id && (
                <div className="text-center p-8 bg-muted/30 rounded-lg">
                  <p className="text-muted-foreground">
                    Salve o produto primeiro para adicionar variações de litragem
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex space-x-2 pt-4 border-t">
        <Button type="submit" className="flex-1" disabled={saving || uploading}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Produto
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
