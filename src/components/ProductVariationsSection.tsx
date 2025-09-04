import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useProductVariations } from '@/hooks/useProductVariations';
import { ProductVariation } from '@/types/product';
import { useProductFragrances } from '@/hooks/useProductFragrances';
import ProductFragrancesSection from '@/components/ProductFragrancesSection';

interface ProductVariationsSectionProps {
  productId: string;
  fragrances: any[];
  onFragrancesChange: (fragrances: any[]) => void;
  onVariationImageChange?: (imageUrl: string) => void;
  imageControlledBy?: 'fragrance' | 'volume' | 'none';
}

const ProductVariationsSection = ({ productId, fragrances, onFragrancesChange, onVariationImageChange, imageControlledBy = 'volume' }: ProductVariationsSectionProps) => {
  const { uploadImage, uploading } = useImageUpload();
  const { variations, loading, createVariation, updateVariation, deleteVariation } = useProductVariations(productId);
  const { saveFragrances } = useProductFragrances(productId);
  const [newVariation, setNewVariation] = useState({
    literage: '',
    price: '',
    image_url: ''
  });

  const handleFragrancesChange = (newFragrances: any[]) => {
    onFragrancesChange(newFragrances);
    // Salvar no localStorage também
    saveFragrances(newFragrances);
  };

  const handleAddVariation = async () => {
    if (!newVariation.literage || !newVariation.price) return;

    try {
      await createVariation({
        product_id: productId,
        literage: newVariation.literage,
        price: parseFloat(newVariation.price),
        image_url: newVariation.image_url || null
      });

      // Se tem imagem na nova variação e controle por volume, atualizar a foto principal
      if (newVariation.image_url && onVariationImageChange && imageControlledBy === 'volume') {
        onVariationImageChange(newVariation.image_url);
      }

      setNewVariation({ literage: '', price: '', image_url: '' });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdateVariation = async (id: string, field: keyof ProductVariation, value: string | number) => {
    try {
      const updates = { [field]: value };
      await updateVariation(id, updates);

      // Se atualizou imagem e é a primeira variação, atualizar foto principal
      if (field === 'image_url' && variations[0]?.id === id && onVariationImageChange && value && imageControlledBy === 'volume') {
        onVariationImageChange(value as string);
      }
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleImageUpload = async (file: File, variationId?: string) => {
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      if (variationId) {
        await handleUpdateVariation(variationId, 'image_url', imageUrl);
      } else {
        setNewVariation(prev => ({ ...prev, image_url: imageUrl }));
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando variações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seção de Variações de Volume */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Variações de Volume</h3>
        </div>
        
        {/* Variações existentes */}
        <div className="space-y-3">
          {variations.map((variation, index) => (
            <Card key={variation.id} className="border-l-4 border-l-primary/20">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label className="text-sm font-medium">Tamanho/Volume</Label>
                    <Input
                      value={variation.literage}
                      onChange={(e) => handleUpdateVariation(variation.id, 'literage', e.target.value)}
                      placeholder="Ex: 500ml, 1L"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={variation.price}
                      onChange={(e) => handleUpdateVariation(variation.id, 'price', parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Imagem específica</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(e.target.files[0], variation.id);
                          }
                        }}
                        disabled={uploading}
                        className="text-xs"
                      />
                      {variation.image_url && (
                        <div className="relative">
                          <img 
                            src={variation.image_url} 
                            alt="Preview" 
                            className="w-12 h-12 object-cover rounded border"
                          />
                          {index === 0 && (
                            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-1 rounded">
                              Principal
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteVariation(variation.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Nova variação */}
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nova Variação de Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Tamanho/Volume</Label>
                <Input
                  placeholder="Ex: 500ml, 1L, 2L"
                  value={newVariation.literage}
                  onChange={(e) => setNewVariation(prev => ({ ...prev, literage: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newVariation.price}
                  onChange={(e) => setNewVariation(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Imagem (opcional)</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleImageUpload(e.target.files[0]);
                      }
                    }}
                    disabled={uploading}
                  />
                  {newVariation.image_url && (
                    <img 
                      src={newVariation.image_url} 
                      alt="Preview" 
                      className="w-12 h-12 object-cover rounded border"
                    />
                  )}
                </div>
              </div>
            </div>
            <Button 
              onClick={handleAddVariation}
              disabled={!newVariation.literage || !newVariation.price || uploading}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Variação de Volume
            </Button>
          </CardContent>
        </Card>
        
        {uploading && (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Fazendo upload da imagem...
          </div>
        )}

        {variations.length > 0 && (
          <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded">
            💡 <strong>Dica:</strong> A primeira variação será usada como imagem principal do produto. 
            Organize as variações por ordem de importância.
          </div>
        )}
      </div>

      <Separator />

      {/* Seção de Fragrâncias */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Fragrâncias Disponíveis</h3>
        </div>
        <ProductFragrancesSection 
          fragrances={fragrances}
          onFragrancesChange={handleFragrancesChange}
          onFragranceImageChange={(url) => {
            if (imageControlledBy === 'fragrance' && onVariationImageChange) {
              onVariationImageChange(url);
            }
          }}
        />
      </div>
    </div>
  );
};

export default ProductVariationsSection;