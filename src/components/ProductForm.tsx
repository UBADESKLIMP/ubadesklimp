
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Loader2, Star, Package, Settings, Layers, Car, Droplets, MapPin, ShoppingCart } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductVariationsSection from './ProductVariationsSection';
import PriorityPositionSelect from './PriorityPositionSelect';
import { ProductAiSuggestions } from '@/lib/productResearchDraft';

interface ProductFormProps {
  product?: ProductWithVariations | null;
  onSave: (productData: any) => Promise<void>;
  onCancel: () => void;
  aiSuggestions?: ProductAiSuggestions;
}

const ProductForm = ({ product, onSave, onCancel, aiSuggestions }: ProductFormProps) => {
  const { uploadImage, uploadImageFromUrl, uploading } = useImageUpload();
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState('basic');
  const previousProductIdRef = useRef<string | undefined>(product?.id);

  useEffect(() => {
    const hadNoId = !previousProductIdRef.current;
    const hasIdNow = !!product?.id;
    const hasPendingSuggestions =
      !!aiSuggestions && (aiSuggestions.sizes.length > 0 || aiSuggestions.fragrances.length > 0);
    if (hadNoId && hasIdNow && hasPendingSuggestions) {
      setActiveTab('variations');
    }
    previousProductIdRef.current = product?.id;
  }, [product?.id, aiSuggestions]);
  
  // Linha do produto (limpeza ou automotivo)
  const [lineType, setLineType] = useState<'limpeza' | 'automotivo'>(
    product?.line_type || 'limpeza'
  );
  
  // Buscar categorias filtradas pela linha
  const { categories } = useCategories(lineType);
  
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
    literage_single: string;
    out_of_stock: boolean;
    size_unit: 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades';
    price_position: 'below_image' | 'below_text';
    action_type: string;
    ph_level: string;
    application_area: string;
    brand: string;
    purchase_min_quantity: string;
    purchase_max_quantity: string;
    purchase_notes: string;
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
    literage_single: (product as any)?.literage_single || '',
    out_of_stock: (product as any)?.out_of_stock || false,
    size_unit: (product as any)?.size_unit || 'litros',
    price_position: (product as any)?.price_position || 'below_text',
    action_type: (product as any)?.action_type || '',
    ph_level: (product as any)?.ph_level || '',
    application_area: (product as any)?.application_area || '',
    brand: (product as any)?.brand || '',
    purchase_min_quantity: product?.purchase_min_quantity || '',
    purchase_max_quantity: product?.purchase_max_quantity || '',
    purchase_notes: product?.purchase_notes || '',
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

  // Atualizar formData e lineType quando o produto mudar (após refetch)
  useEffect(() => {
    if (product) {
      setLineType(product.line_type || 'limpeza');
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        category: product.category || '',
        image_url: product.image_url || '',
        priority: product.priority || false,
        priority_order: product.priority_order?.toString() || '0',
        has_variations: product.has_variations || false,
        has_fragrances: !!product.fragrances?.length,
        highlight_type: product.highlight_type || '',
        material: product.material || '',
        validity: product.validity || '',
        specifications: product.specifications || '',
        fragrances: product.fragrances || [],
        literage_single: (product as any)?.literage_single || '',
        out_of_stock: (product as any)?.out_of_stock || false,
        size_unit: (product as any)?.size_unit || 'litros',
        price_position: (product as any)?.price_position || 'below_text',
        action_type: (product as any)?.action_type || '',
        ph_level: (product as any)?.ph_level || '',
        application_area: (product as any)?.application_area || '',
        brand: (product as any)?.brand || '',
        purchase_min_quantity: product.purchase_min_quantity || '',
        purchase_max_quantity: product.purchase_max_quantity || '',
        purchase_notes: product.purchase_notes || '',
      });
    }
  }, [product]);

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
        literage_single: formData.literage_single || null,
        out_of_stock: formData.out_of_stock,
        size_unit: formData.size_unit,
        price_position: formData.price_position,
        action_type: formData.action_type || null,
        ph_level: formData.ph_level || null,
        application_area: formData.application_area || null,
        brand: formData.brand || null,
        purchase_min_quantity: formData.purchase_min_quantity || null,
        purchase_max_quantity: formData.purchase_max_quantity || null,
        purchase_notes: formData.purchase_notes || null,
        line_type: lineType,
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
      {aiSuggestions?.confidence === 'none' && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive-foreground">
          Não encontrei detalhes confiáveis pra esse produto — preencha manualmente.
        </div>
      )}
      {aiSuggestions?.confidence === 'low' && (
        <div className="p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-sm text-yellow-100">
          Não tenho certeza sobre alguns destes dados — confira com atenção antes de salvar.
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Básico</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Detalhes</span>
          </TabsTrigger>
          <TabsTrigger
            value="variations"
            className="flex items-center space-x-2"
            disabled={!formData.has_variations && !(aiSuggestions?.fragrances && aiSuggestions.fragrances.length > 0)}
          >
            <Layers className="h-4 w-4" />
            <span>Variações</span>
          </TabsTrigger>
          <TabsTrigger value="compras" className="flex items-center space-x-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Compras</span>
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

              {!formData.has_variations && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="size_unit">Unidade de Medida</Label>
                    <Select value={formData.size_unit} onValueChange={(value: any) => setFormData({...formData, size_unit: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="litros">💧 Litros (L) - Produtos líquidos</SelectItem>
                        <SelectItem value="ml">💧 Mililitros (ml) - Volumes pequenos</SelectItem>
                        <SelectItem value="cm">📏 Centímetros (cm) - Dimensões físicas</SelectItem>
                        <SelectItem value="kg">⚖️ Quilogramas (kg) - Peso em kg</SelectItem>
                        <SelectItem value="g">⚖️ Gramas (g) - Peso em gramas</SelectItem>
                        <SelectItem value="unidades">📦 Unidades - Quantidade de itens</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formData.size_unit === 'unidades' && '📦 Use para: pacotes, rolos, peças, caixas'}
                      {formData.size_unit === 'litros' && '💧 Use para: líquidos em litros (Ex: 5L)'}
                      {formData.size_unit === 'ml' && '💧 Use para: líquidos em ml (Ex: 500ml)'}
                      {formData.size_unit === 'kg' && '⚖️ Use para: produtos pesados (Ex: 1kg)'}
                      {formData.size_unit === 'g' && '⚖️ Use para: produtos leves (Ex: 500g)'}
                      {formData.size_unit === 'cm' && '📏 Use para: dimensões (Ex: 30cm)'}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="literage_single">
                      {formData.size_unit === 'litros' ? 'Litragem' : 
                       formData.size_unit === 'ml' ? 'Volume (ml)' :
                       formData.size_unit === 'cm' ? 'Tamanho (cm)' :
                       formData.size_unit === 'kg' ? 'Peso (kg)' :
                       formData.size_unit === 'g' ? 'Peso (g)' :
                       'Quantidade'}
                    </Label>
                    <Input
                      id="literage_single"
                      value={formData.literage_single}
                      onChange={(e) => setFormData({...formData, literage_single: e.target.value})}
                      placeholder={
                        formData.size_unit === 'litros' ? 'Ex: 5L' :
                        formData.size_unit === 'ml' ? 'Ex: 500ml' :
                        formData.size_unit === 'cm' ? 'Ex: 30cm' :
                        formData.size_unit === 'kg' ? 'Ex: 1kg' :
                        formData.size_unit === 'g' ? 'Ex: 500g' :
                        'Ex: 2 unidades'
                      }
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      {formData.size_unit === 'unidades' ? 
                        '📦 Quantidade de itens no pacote (Ex: "2 unidades", "6 rolos")' :
                        'Especifique o valor com a unidade (Ex: "5L", "500g", "30cm")'
                      }
                    </p>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="line_type">Linha do Produto *</Label>
                  <Select value={lineType} onValueChange={(value: 'limpeza' | 'automotivo') => {
                    setLineType(value);
                    // Limpar categoria ao trocar de linha
                    setFormData({...formData, category: ''});
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a linha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limpeza">
                        <div className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-cyan-500" />
                          <span>Limpeza</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="automotivo">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4 text-blue-500" />
                          <span>Automotivo</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="category">Categoria *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          Nenhuma categoria {lineType === 'automotivo' ? 'automotiva' : 'de limpeza'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Categorias da linha {lineType === 'automotivo' ? 'Automotiva' : 'Limpeza'}
                  </p>
                </div>
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
                  {!formData.image_url && aiSuggestions?.mainImageUrl && (
                    <div className="flex items-center gap-3 p-2 rounded border border-dashed border-blue-500/40">
                      <img
                        src={aiSuggestions.mainImageUrl}
                        alt="Sugestão da IA"
                        className="w-16 h-16 object-contain rounded border bg-muted/50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="flex-1 text-sm text-muted-foreground">Foto sugerida pela IA</div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={uploading}
                        onClick={async () => {
                          const uploaded = await uploadImageFromUrl(aiSuggestions.mainImageUrl!);
                          if (uploaded) setFormData(prev => ({ ...prev, image_url: uploaded }));
                        }}
                      >
                        Usar esta foto
                      </Button>
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
                  placeholder="Informações adicionais sobre o produto..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ℹ️ Use este campo para descrição textual (Ex: "toalhas por rolo", "componentes incluídos"). Para dados estruturados como quantidade ou volume, use os campos específicos acima.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Campos Técnicos - Ação e Uso Indicado (ambas as linhas) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {lineType === 'automotivo' ? (
                  <Car className="h-5 w-5 text-blue-400" />
                ) : (
                  <Droplets className="h-5 w-5 text-cyan-500" />
                )}
                {lineType === 'automotivo' ? 'Detalhes Técnicos Automotivos' : 'Detalhes Técnicos'}
                <span className="text-sm font-normal text-muted-foreground">(opcionais)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lineType === 'automotivo' && (
                  <div>
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      placeholder="Ex: Vonixx, Vintex..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Permite filtrar produtos por marca na página
                    </p>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="action_type" className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-400" />
                    Ação
                  </Label>
                  <Input
                    id="action_type"
                    value={formData.action_type}
                    onChange={(e) => setFormData({...formData, action_type: e.target.value})}
                    placeholder={lineType === 'automotivo' ? 'Ex: Desengraxante, Limpador...' : 'Ex: Desengordurante, Bactericida...'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lineType === 'automotivo' && (
                  <div>
                    <Label htmlFor="ph_level">PH</Label>
                    <Input
                      id="ph_level"
                      value={formData.ph_level}
                      onChange={(e) => setFormData({...formData, ph_level: e.target.value})}
                      placeholder="Ex: Neutro, Ácido, 7.0..."
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="application_area" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    {lineType === 'automotivo' ? 'Local de Aplicação' : 'Uso Indicado'}
                  </Label>
                  <Input
                    id="application_area"
                    value={formData.application_area}
                    onChange={(e) => setFormData({...formData, application_area: e.target.value})}
                    placeholder={lineType === 'automotivo' ? 'Ex: Motor, Lataria, Rodas...' : 'Ex: Cozinha, Banheiro, Pisos...'}
                  />
                </div>
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
                <PriorityPositionSelect
                  value={formData.priority_order}
                  onChange={(value) => setFormData({...formData, priority_order: value})}
                  currentProductId={product?.id}
                  lineType={lineType}
                />
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
                  onCheckedChange={(checked) => {
                    setFormData({
                      ...formData, 
                      has_variations: checked,
                      fragrances: checked ? formData.fragrances : []
                    });
                  }}
                />
                <span className="text-sm text-muted-foreground ml-2">
                  {formData.has_variations ? 'Possui diferentes tamanhos/preços' : 'Produto único'}
                </span>
              </div>

              <div className="flex items-center space-x-2 p-4 border rounded-lg bg-muted/30">
                <Package className="h-5 w-5 text-destructive" />
                <Label htmlFor="out_of_stock" className="font-medium">Produto Esgotado</Label>
                <Switch
                  id="out_of_stock"
                  checked={formData.out_of_stock}
                  onCheckedChange={(checked) => setFormData({...formData, out_of_stock: checked})}
                />
                <span className="text-sm text-muted-foreground ml-2">
                  {formData.out_of_stock ? 'Marcado como em falta/esgotado' : 'Disponível para compra'}
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
                  aiSuggestedSizes={aiSuggestions?.sizes}
                  aiSuggestedFragrances={aiSuggestions?.fragrances}
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

        {/* Aba Compras */}
        <TabsContent value="compras" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações de Compra</CardTitle>
              <p className="text-sm text-muted-foreground">
                Uso interno — nunca aparece no site, ajuda a lembrar como esse produto costuma ser comprado
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purchase_min_quantity">Compra mínima</Label>
                  <Input
                    id="purchase_min_quantity"
                    value={formData.purchase_min_quantity}
                    onChange={(e) => setFormData({ ...formData, purchase_min_quantity: e.target.value })}
                    placeholder="Ex: 2cx"
                  />
                </div>
                <div>
                  <Label htmlFor="purchase_max_quantity">Compra máxima</Label>
                  <Input
                    id="purchase_max_quantity"
                    value={formData.purchase_max_quantity}
                    onChange={(e) => setFormData({ ...formData, purchase_max_quantity: e.target.value })}
                    placeholder="Ex: 5cx (o que cabe no estoque)"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="purchase_notes">Observações de compra</Label>
                <Textarea
                  id="purchase_notes"
                  value={formData.purchase_notes}
                  onChange={(e) => setFormData({ ...formData, purchase_notes: e.target.value })}
                  rows={4}
                  placeholder="Fornecedor preferido, prazo de entrega, condição de pagamento, o que mais for útil lembrar na hora de comprar..."
                />
              </div>
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
