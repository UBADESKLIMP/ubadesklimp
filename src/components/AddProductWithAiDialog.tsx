import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProductResearch } from '@/hooks/useProductResearch';
import { buildProductDraft, buildAiSuggestions, ProductAiSuggestions } from '@/lib/productResearchDraft';
import { ProductWithVariations } from '@/types/product';

interface AddProductWithAiDialogProps {
  lineType: 'limpeza' | 'automotivo';
  onResult: (draft: Partial<ProductWithVariations>, suggestions: ProductAiSuggestions) => void;
}

const AddProductWithAiDialog = ({ lineType, onResult }: AddProductWithAiDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [sizeHint, setSizeHint] = useState('');
  const { research, researching } = useProductResearch();

  const handleSearch = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const result = await research(trimmedName, sizeHint.trim(), lineType);
    if (!result) return;

    onResult(buildProductDraft(result, trimmedName, lineType), buildAiSuggestions(result));
    setOpen(false);
    setName('');
    setSizeHint('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
          <Sparkles className="h-4 w-4 mr-2" />
          Adicionar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0f18] border-blue-500/30 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Adicionar produto com IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ai-product-name">Nome do produto</Label>
            <Input
              id="ai-product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: veja multiuso"
              disabled={researching}
              className="text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="ai-product-size">Tamanho conhecido (opcional)</Label>
            <Input
              id="ai-product-size"
              value={sizeHint}
              onChange={(e) => setSizeHint(e.target.value)}
              placeholder="Ex: 500ml"
              disabled={researching}
              className="text-foreground"
            />
          </div>
          <Button onClick={handleSearch} disabled={researching || !name.trim()} className="w-full">
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pesquisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Pesquisar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductWithAiDialog;
