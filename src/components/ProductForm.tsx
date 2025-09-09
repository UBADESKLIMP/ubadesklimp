
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Loader2, Star, Package, Settings, Layers } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductVariationsSection from './ProductVariationsSection';

interface ProductFormProps {
  product?: ProductWithVariations | null;
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
}

const ProductForm = ({ product, onSave, onCancel }: ProductFormProps) => {
  const { uploadImage, uploading } = useImageUpload();
  const { categories } = useCategories();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: string;
    category: string;
    image_url: string;
    priority: boolean;
    priority_order: string;
    has_variations: boolean;
    has_fragrances: boolean;
    highlight_type: string;
    material: string;
    validity: string;
    specifications: string;
    fragrances: any[];
  }>({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price?.toString() || '',
    category: product?.category || '',
    image_url: product?.image_url || '',
    priority: product?.priority || false,
    priority_order: product?.priority_order?.toString() || '0',
    has_variations: product?.has_variations || false,
    has_fragrances: !!product?.fragrances?.length,
    highlight_type: product?.highlight_type || '',
    material: product?.material || '',
    validity: product?.validity || '',
    specifications: product?.specifications || '',
    fragrances: product?.fragrances || [],
  });

  useEffect(() => {
    if (product?.id) {
      try {
        localStorage.setItem(`fragrances_${product.id}`, JSON.stringify(formData.fragrances));
      } catch (e) {
        console.error('Erro ao persistir fragrâncias no localStorage:', e);
      }
    }
  }, [formData.fragrances, product?.id]);

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
    
    if (!formData.name || !formData.price || !formData.category) {
      return;
    }

    setSaving(true);
    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price || '0'),
        category: formData.category,
        image_url: formData.image_url || null,
        priority: formData.priority,
        priority_order: parseInt(formData.priority_order || '0'),
        has_variations: formData.has_variations,
        has_fragrances: formData.fragrances.length > 0,
        highlight_type: formData.highlight_type === 'none' ? null : formData.highlight_type || null,
        material: formData.material || null,
        validity: formData.validity || null,
        specifications: formData.specifications || null,
      };

      await onSave({ ...productData, fragrances: formData.fragrances });
    } finally {
      setSaving(false);
    }
  };

  const updateMainImage = (imageUrl: string) => {
    setFormData(prev => ({ ...prev, image_url: imageUrl }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Básico</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Detalhes</span>
          </TabsTrigger>
          <TabsTrigger value="variations" className="flex items-center space-x-2" disabled={!formData.has_variations}>
            <Layers className="h-4 w-4" />
            <span>Variações</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba Básica */}
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
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={4}
                  placeholder="Descrição do produto"
                />
              </div>
              
              <div>
                <Label htmlFor="price">Preço Base (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  placeholder="15.90"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {formData.has_variations ? 'Preço usado quando não há variações' : 'Preço final do produto'}
                </p>
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
        </TabsContent>

        {/* Aba Detalhes */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="material">Material</Label>
                <Input
                  id="material"
                  value={formData.material}
                  onChange={(e) => setFormData({...formData, material: e.target.value})}
                  placeholder="Ex: Plástico, Metal, Vidro"
                />
              </div>

              <div>
                <Label htmlFor="validity">Validade</Label>
                <Input
                  id="validity"
                  value={formData.validity}
                  onChange={(e) => setFormData({...formData, validity: e.target.value})}
                  placeholder="Ex: 2 anos, 6 meses"
                />
              </div>

              <div>
                <Label htmlFor="specifications">Especificações</Label>
                <Textarea
                  id="specifications"
                  value={formData.specifications}
                  onChange={(e) => setFormData({...formData, specifications: e.target.value})}
                  rows={3}
                  placeholder="Especificações técnicas do produto"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações</CardTitle>
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
                  <Input
                    id="priority_order"
                    type="number"
                    min="0"
                    value={formData.priority_order}
                    onChange={(e) => setFormData({...formData, priority_order: e.target.value})}
                    placeholder="0"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Menor número = maior prioridade
                  </p>
                </div>
              )}

              {formData.priority && (
                <div>
                  <Label htmlFor="highlight_type">Tipo de Destaque</Label>
                  <Select value={formData.highlight_type} onValueChange={(value) => setFormData({...formData, highlight_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de destaque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem destaque específico</SelectItem>
                      <SelectItem value="bestseller">🏆 Mais Vendido</SelectItem>
                      <SelectItem value="promotion">🎯 Promoção</SelectItem>
                      <SelectItem value="new">✨ Novidade</SelectItem>
                      <SelectItem value="featured">⭐ Destaque</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha o tipo de destaque que aparecerá no produto
                  </p>
                </div>
              )}

              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                <Layers className="h-5 w-5 text-primary" />
                <Label htmlFor="has_variations" className="font-medium">Produto com Variações</Label>
                <Switch
                  id="has_variations"
                  checked={formData.has_variations}
                  onCheckedChange={(checked) => setFormData({...formData, has_variations: checked})}
                />
                <span className="text-sm text-muted-foreground ml-2">
                  {formData.has_variations ? 'Possui diferentes tamanhos/preços' : 'Produto único'}
                </span>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Variações */}
        <TabsContent value="variations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Variações do Produto</CardTitle>
              <p className="text-sm text-muted-foreground">
                Defina diferentes tamanhos, volumes ou versões do produto com preços específicos
              </p>
            </CardHeader>
            <CardContent>
              {product?.id ? (
                <ProductVariationsSection 
                  productId={product.id} 
                  fragrances={formData.fragrances}
                  onFragrancesChange={(fragrances) => setFormData(prev => ({ ...prev, fragrances }))}
                  onMainImageChange={updateMainImage}
                />
              ) : (
                <div className="text-center p-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Salve o produto primeiro para gerenciar suas variações</p>
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
