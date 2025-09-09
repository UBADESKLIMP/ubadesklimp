import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Flower, Loader2, ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { ProductFragrance } from '@/types/product';
import { useImageUpload } from '@/hooks/useImageUpload';

interface ProductFragrancesSectionProps {
  fragrances: ProductFragrance[];
  onFragrancesChange: (fragrances: ProductFragrance[]) => void;
  onMainImageChange?: (url: string) => void;
  availableLiterages: string[];
}

const ProductFragrancesSection = ({ fragrances, onFragrancesChange, onMainImageChange, availableLiterages }: ProductFragrancesSectionProps) => {
  const { uploadImage, uploading } = useImageUpload();
  const [newFragrance, setNewFragrance] = useState({
    name: '',
    description: '',
    image_url: '',
    available_literages: [...availableLiterages] // Por padrão, todas as litragens
  });

  // Atualizar litragens disponíveis quando mudam
  useEffect(() => {
    setNewFragrance(prev => ({
      ...prev,
      available_literages: [...availableLiterages]
    }));
  }, [availableLiterages]);

  const handleAddFragrance = () => {
    if (!newFragrance.name) return;

    const newId = Date.now().toString(); // Simple ID generation
    const nextOrder = Math.max(...fragrances.map(f => f.order || 0), 0) + 1;
    const updatedFragrances = [
      ...fragrances,
      {
        id: newId,
        name: newFragrance.name,
        description: newFragrance.description || undefined,
        image_url: newFragrance.image_url || undefined,
        available_literages: newFragrance.available_literages,
        order: nextOrder
      }
    ];

    onFragrancesChange(updatedFragrances);
    
    // Atualizar imagem principal automaticamente se esta fragrância tem imagem
    if (newFragrance.image_url && onMainImageChange) {
      onMainImageChange(newFragrance.image_url);
    }
    
    setNewFragrance({ 
      name: '', 
      description: '', 
      image_url: '',
      available_literages: [...availableLiterages]
    });
  };

  const handleUpdateFragrance = (id: string, field: 'name' | 'description' | 'image_url' | 'available_literages', value: string | string[]) => {
    const updatedFragrances = fragrances.map(fragrance =>
      fragrance.id === id
        ? { ...fragrance, [field]: value }
        : fragrance
    );
    onFragrancesChange(updatedFragrances);
    
    // Se atualizou a imagem, atualizar a imagem principal automaticamente
    if (field === 'image_url' && value && onMainImageChange) {
      onMainImageChange(value as string);
    }
  };

  const moveFragrance = (index: number, direction: 'up' | 'down') => {
    const sortedFragrances = [...fragrances].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sortedFragrances.length - 1)) {
      return; // Não pode mover
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Trocar as ordens
    const fragrance1 = sortedFragrances[index];
    const fragrance2 = sortedFragrances[newIndex];
    
    const updatedFragrances = fragrances.map(f => {
      if (f.id === fragrance1.id) {
        return { ...f, order: fragrance2.order || 0 };
      }
      if (f.id === fragrance2.id) {
        return { ...f, order: fragrance1.order || 0 };
      }
      return f;
    });

    onFragrancesChange(updatedFragrances);

    // Atualizar imagem principal se a primeira fragrância mudou
    const newSortedFragrances = updatedFragrances.sort((a, b) => (a.order || 0) - (b.order || 0));
    const firstFragranceWithImage = newSortedFragrances.find(f => f.image_url);
    if (firstFragranceWithImage?.image_url && onMainImageChange) {
      onMainImageChange(firstFragranceWithImage.image_url);
    }
  };

  const toggleLiteragePage = (fragranceId: string, literage: string, isChecked: boolean) => {
    const fragrance = fragrances.find(f => f.id === fragranceId);
    if (!fragrance) return;

    const currentLiterages = fragrance.available_literages || [];
    let newLiterages;
    
    if (isChecked) {
      newLiterages = [...currentLiterages, literage];
    } else {
      newLiterages = currentLiterages.filter(l => l !== literage);
    }
    
    handleUpdateFragrance(fragranceId, 'available_literages', newLiterages);
  };

  const handleImageUpload = async (file: File, fragranceId?: string) => {
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      if (fragranceId) {
        handleUpdateFragrance(fragranceId, 'image_url', imageUrl);
      } else {
        setNewFragrance(prev => ({ ...prev, image_url: imageUrl }));
      }
      
      // Atualizar imagem principal automaticamente
      if (onMainImageChange) {
        onMainImageChange(imageUrl);
      }
    }
  };

  const handleDeleteFragrance = (id: string) => {
    const updatedFragrances = fragrances.filter(f => f.id !== id);
    onFragrancesChange(updatedFragrances);
  };

  return (
    <div className="space-y-4">
      {/* Fragrâncias existentes */}
      <div className="space-y-3">
        {fragrances
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((fragrance, index) => (
          <Card key={fragrance.id} className="border-l-4 border-l-purple-500/20">
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Linha principal com nome, descrição e imagem */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label className="text-sm font-medium">Nome da Fragrância</Label>
                    <Input
                      value={fragrance.name}
                      onChange={(e) => handleUpdateFragrance(fragrance.id, 'name', e.target.value)}
                      placeholder="Ex: Lavanda, Citrus, Vanilla"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Descrição (opcional)</Label>
                    <Textarea
                      value={fragrance.description || ''}
                      onChange={(e) => handleUpdateFragrance(fragrance.id, 'description', e.target.value)}
                      placeholder="Descrição da fragrância..."
                      className="min-h-[40px]"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Imagem da fragrância</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(e.target.files[0], fragrance.id);
                          }
                        }}
                        disabled={uploading}
                        className="text-xs"
                      />
                      {fragrance.image_url && (
                        <div className="relative">
                          <img 
                            src={fragrance.image_url} 
                            alt="Preview" 
                            className="w-12 h-12 object-cover rounded border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end space-x-1">
                    {/* Botões de reordenamento */}
                    <div className="flex flex-col space-y-1">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveFragrance(index, 'up')}
                        disabled={index === 0}
                        className="h-8 w-8"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => moveFragrance(index, 'down')}
                        disabled={index === fragrances.length - 1}
                        className="h-8 w-8"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteFragrance(fragrance.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Seleção de litragens */}
                {availableLiterages.length > 0 && (
                  <div className="border-t pt-3">
                    <Label className="text-sm font-medium mb-2 block">
                      Litragens disponíveis para esta fragrância:
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {availableLiterages.map((literage) => {
                        const isChecked = (fragrance.available_literages || []).includes(literage);
                        return (
                          <label key={literage} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => toggleLiteragePage(fragrance.id, literage, e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{literage}</span>
                          </label>
                        );
                      })}
                    </div>
                    {(fragrance.available_literages || []).length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        ⚠️ Esta fragrância não tem nenhuma litragem selecionada!
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Nova fragrância */}
      <Card className="border-dashed border-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center">
            <Flower className="h-4 w-4 mr-2" />
            Adicionar Nova Fragrância
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Nome da Fragrância</Label>
              <Input
                placeholder="Ex: Lavanda, Citrus, Vanilla"
                value={newFragrance.name}
                onChange={(e) => setNewFragrance(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Descrição (opcional)</Label>
              <Textarea
                placeholder="Descrição da fragrância..."
                value={newFragrance.description}
                onChange={(e) => setNewFragrance(prev => ({ ...prev, description: e.target.value }))}
                className="min-h-[40px]"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Litragens disponíveis (opcional)</Label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {availableLiterages.map((literage) => {
                    const isChecked = newFragrance.available_literages.includes(literage);
                    return (
                      <label key={literage} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewFragrance(prev => ({
                                ...prev,
                                available_literages: [...prev.available_literages, literage]
                              }));
                            } else {
                              setNewFragrance(prev => ({
                                ...prev,
                                available_literages: prev.available_literages.filter(l => l !== literage)
                              }));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{literage}</span>
                      </label>
                    );
                  })}
          </div>
          
          {/* Campo de imagem separado */}
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
              {newFragrance.image_url && (
                <img 
                  src={newFragrance.image_url} 
                  alt="Preview" 
                  className="w-12 h-12 object-cover rounded border"
                />
              )}
            </div>
          </div>
                {availableLiterages.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Adicione primeiro algumas variações de volume acima para selecionar litragens.
                  </p>
                )}
              </div>
            </div>
          </div>
          <Button 
            onClick={handleAddFragrance}
            disabled={!newFragrance.name || uploading}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Fragrância
          </Button>
        </CardContent>
      </Card>
      
      {uploading && (
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Fazendo upload da imagem...
        </div>
      )}

      {fragrances.length > 0 && (
        <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded">
          🌸 <strong>Sistema Automático:</strong> Quando você adiciona uma imagem a uma fragrância, 
          ela automaticamente vira a imagem principal do produto! Fragrâncias têm prioridade sobre volumes.
        </div>
      )}
    </div>
  );
};

export default ProductFragrancesSection;