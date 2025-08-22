
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useImageUpload } from '@/hooks/useImageUpload';
import { ProductVariation } from '@/types/product';

interface ProductVariationsManagerProps {
  productId: string;
  onVariationsChange?: () => void;
}

const ProductVariationsManager = ({ productId, onVariationsChange }: ProductVariationsManagerProps) => {
  const { uploadImage, uploading } = useImageUpload();
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [newVariation, setNewVariation] = useState({
    literage: '',
    price: '',
    image_url: ''
  });

  // Funcionalidade temporariamente desabilitada até os tipos serem atualizados
  const handleAddVariation = async () => {
    console.log('Add variation functionality will be implemented after types are updated');
  };

  const handleUpdateVariation = async (id: string, field: string, value: string | number) => {
    console.log('Update variation functionality will be implemented after types are updated');
  };

  const handleDeleteVariation = async (id: string) => {
    console.log('Delete variation functionality will be implemented after types are updated');
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
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Carregando variações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Variações do Produto</h3>
      
      {/* Variações existentes */}
      <div className="space-y-3">
        {variations.map((variation) => (
          <Card key={variation.id}>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <Label>Litragem</Label>
                  <Input
                    value={variation.literage}
                    onChange={(e) => handleUpdateVariation(variation.id, 'literage', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variation.price}
                    onChange={(e) => handleUpdateVariation(variation.id, 'price', parseFloat(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Imagem</Label>
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
                        className="w-10 h-10 object-cover rounded border"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteVariation(variation.id)}
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar Nova Variação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Litragem</Label>
              <Input
                placeholder="Ex: 500ml, 1L, 2L"
                value={newVariation.literage}
                onChange={(e) => setNewVariation(prev => ({ ...prev, literage: e.target.value }))}
              />
            </div>
            <div>
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={newVariation.price}
                onChange={(e) => setNewVariation(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div>
              <Label>Imagem</Label>
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
                    className="w-10 h-10 object-cover rounded border"
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
          <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded">
            Funcionalidade de variações será ativada após atualização dos tipos do banco de dados
          </div>
        </CardContent>
      </Card>
      
      {uploading && (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Fazendo upload da imagem...
        </div>
      )}
    </div>
  );
};

export default ProductVariationsManager;
