import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, ImageIcon, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useProductVariations } from '@/hooks/useProductVariations';
import { ProductVariation } from '@/types/product';
import { useProductFragrances } from '@/hooks/useProductFragrances';
import ProductFragrancesSection from '@/components/ProductFragrancesSection';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProductVariationsSectionProps {
  productId: string;
  fragrances: any[];
  onFragrancesChange: (fragrances: any[]) => void;
  onMainImageChange?: (imageUrl: string) => void;
  aiSuggestedSizes?: { literage: string; image_url: string | null }[];
  aiSuggestedFragrances?: { name: string; image_url: string | null }[];
}

const ProductVariationsSection = ({
  productId,
  fragrances,
  onFragrancesChange,
  onMainImageChange,
  aiSuggestedSizes,
  aiSuggestedFragrances,
}: ProductVariationsSectionProps) => {
  const { uploadImage, uploadImageFromUrl, uploading } = useImageUpload();
  const { variations, loading, createVariation, updateVariation, deleteVariation, reorderVariation, setPrimaryVariation } = useProductVariations(productId);
  const { saveFragrances } = useProductFragrances(productId);
  const [newVariation, setNewVariation] = useState({
    literage: '',
    price: '',
    image_url: ''
  });
  const [pendingSizeSuggestions, setPendingSizeSuggestions] = useState(aiSuggestedSizes ?? []);

  const handleFragrancesChange = (newFragrances: any[]) => {
    onFragrancesChange(newFragrances);
  };

  const applySizeSuggestion = async (suggestion: { literage: string; image_url: string | null }) => {
    setPendingSizeSuggestions((prev) => prev.filter((s) => s.literage !== suggestion.literage));
    setNewVariation({ literage: suggestion.literage, price: '', image_url: '' });
    if (suggestion.image_url) {
      const uploaded = await uploadImageFromUrl(suggestion.image_url);
      if (uploaded) {
        setNewVariation((prev) => ({ ...prev, image_url: uploaded }));
      }
    }
  };

  const handleAddVariation = async () => {
    if (!newVariation.literage || !newVariation.price) return;

    try {
      await createVariation({
        product_id: productId,
        literage: newVariation.literage,
        price: parseFloat(newVariation.price),
        image_url: newVariation.image_url || null,
        is_primary: variations.length === 0,
        display_order: 0
      });

      setNewVariation({ literage: '', price: '', image_url: '' });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdateVariation = async (id: string, field: keyof ProductVariation, value: string | number) => {
    try {
      const updates = { [field]: value };
      await updateVariation(id, updates);
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
      {/* Seção de Variações */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Variações do Produto</h3>
          <p className="text-sm text-muted-foreground">(Tamanhos, Volumes, etc.)</p>
        </div>
        
        {/* Variações existentes */}
        <div className="space-y-3">
          {variations.map((variation, index) => (
            <Card key={variation.id} className={`border-l-4 ${variation.is_primary ? 'border-l-yellow-500' : 'border-l-primary/20'}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Controles de ordenação */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => reorderVariation(variation.id, 'up')}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => reorderVariation(variation.id, 'down')}
                      disabled={index === variations.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Conteúdo principal */}
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                      {variation.is_primary && (
                        <Badge variant="default" className="bg-yellow-500">
                          <Star className="h-3 w-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                      {!variation.is_primary && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPrimaryVariation(variation.id)}
                          className="h-7 text-xs"
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Marcar como principal
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div>
                        <Label className="text-sm font-medium">Tamanho/Volume/Quantidade</Label>
                        <Input
                          value={variation.literage}
                          onChange={(e) => handleUpdateVariation(variation.id, 'literage', e.target.value)}
                          placeholder="Ex: 60cm, 5L, 500ml"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Digite com a unidade (ex: 60cm, 5L, 500ml)
                        </p>
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
                      <div className="col-span-2">
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
                            <img 
                              src={variation.image_url} 
                              alt="Preview" 
                              className="w-12 h-12 object-cover rounded border"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botão deletar */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => deleteVariation(variation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {pendingSizeSuggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashed border-blue-500/40 bg-muted/20">
            <span className="text-sm text-muted-foreground mr-1">Sugestões da IA:</span>
            {pendingSizeSuggestions.map((suggestion) => (
              <Button
                key={suggestion.literage}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => applySizeSuggestion(suggestion)}
              >
                {suggestion.literage}
              </Button>
            ))}
          </div>
        )}

        {/* Nova variação */}
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Nova Variação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/30 p-3 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Dica:</strong> Digite o tamanho/volume diretamente com a unidade de medida. 
                Exemplos: <code className="bg-background px-1 py-0.5 rounded">60cm</code>, 
                <code className="bg-background px-1 py-0.5 rounded ml-1">5L</code>, 
                <code className="bg-background px-1 py-0.5 rounded ml-1">500ml</code>, 
                <code className="bg-background px-1 py-0.5 rounded ml-1">2kg</code>
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Tamanho/Volume/Quantidade *</Label>
                <Input
                  placeholder="Ex: 60cm, 5L, 500ml, 2kg"
                  value={newVariation.literage}
                  onChange={(e) => setNewVariation(prev => ({ ...prev, literage: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Informe com a unidade (cm, L, ml, kg, g, etc)
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Preço (R$) *</Label>
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
              Adicionar Variação
            </Button>
          </CardContent>
        </Card>
        
        {uploading && (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Fazendo upload da imagem...
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
          onMainImageChange={onMainImageChange}
          availableLiterages={variations.map(v => v.literage)}
          aiSuggestedFragrances={aiSuggestedFragrances}
        />
      </div>
    </div>
  );
};

export default ProductVariationsSection;