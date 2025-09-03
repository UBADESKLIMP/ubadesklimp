import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Flower } from 'lucide-react';
import { ProductFragrance } from '@/types/product';

interface ProductFragrancesSectionProps {
  fragrances: ProductFragrance[];
  onFragrancesChange: (fragrances: ProductFragrance[]) => void;
}

const ProductFragrancesSection = ({ fragrances, onFragrancesChange }: ProductFragrancesSectionProps) => {
  const [newFragrance, setNewFragrance] = useState({
    name: '',
    description: ''
  });

  const handleAddFragrance = () => {
    if (!newFragrance.name) return;

    const newId = Date.now().toString(); // Simple ID generation
    const updatedFragrances = [
      ...fragrances,
      {
        id: newId,
        name: newFragrance.name,
        description: newFragrance.description || undefined
      }
    ];

    onFragrancesChange(updatedFragrances);
    setNewFragrance({ name: '', description: '' });
  };

  const handleUpdateFragrance = (id: string, field: 'name' | 'description', value: string) => {
    const updatedFragrances = fragrances.map(fragrance =>
      fragrance.id === id
        ? { ...fragrance, [field]: value }
        : fragrance
    );
    onFragrancesChange(updatedFragrances);
  };

  const handleDeleteFragrance = (id: string) => {
    const updatedFragrances = fragrances.filter(f => f.id !== id);
    onFragrancesChange(updatedFragrances);
  };

  return (
    <div className="space-y-4">
      {/* Fragrâncias existentes */}
      <div className="space-y-3">
        {fragrances.map((fragrance) => (
          <Card key={fragrance.id} className="border-l-4 border-l-purple-500/20">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteFragrance(fragrance.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
          <Button 
            onClick={handleAddFragrance}
            disabled={!newFragrance.name}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Fragrância
          </Button>
        </CardContent>
      </Card>

      {fragrances.length > 0 && (
        <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded">
          🌸 <strong>Dica:</strong> As fragrâncias aparecerão como opções para o cliente escolher junto com o volume do produto.
        </div>
      )}
    </div>
  );
};

export default ProductFragrancesSection;