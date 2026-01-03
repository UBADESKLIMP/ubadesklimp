import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Download, Loader2, ImageIcon, Sparkles } from 'lucide-react';
import { removeBackground, loadImage } from '@/lib/backgroundRemoval';
import { useToast } from '@/hooks/use-toast';

const BackgroundRemover = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    setProcessingStatus('Carregando modelo de IA...');

    try {
      // Load image element
      const response = await fetch(originalImage);
      const blob = await response.blob();
      const imageElement = await loadImage(blob);

      setProcessingStatus('Processando imagem...');

      // Remove background
      const resultBlob = await removeBackground(imageElement);

      // Convert blob to data URL for display
      const reader = new FileReader();
      reader.onload = (e) => {
        setProcessedImage(e.target?.result as string);
        setProcessingStatus('');
        toast({
          title: 'Sucesso!',
          description: 'Fundo removido com sucesso.',
        });
      };
      reader.readAsDataURL(resultBlob);
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      setProcessingStatus('');
      toast({
        title: 'Erro ao processar',
        description: 'Não foi possível remover o fundo. Tente outra imagem.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;

    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'imagem-sem-fundo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Remover Fundo com IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="flex flex-col items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!originalImage ? (
            <Button
              variant="outline"
              className="w-full h-32 border-dashed border-2 flex flex-col gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8" />
              <span>Clique para selecionar uma imagem</span>
            </Button>
          ) : (
            <div className="w-full space-y-4">
              {/* Image Preview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Image */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Original</p>
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={originalImage}
                      alt="Original"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                </div>

                {/* Processed Image */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sem Fundo</p>
                  <div 
                    className="relative aspect-video rounded-lg overflow-hidden flex items-center justify-center"
                    style={{
                      background: processedImage 
                        ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px'
                        : 'hsl(var(--muted))'
                    }}
                  >
                    {processedImage ? (
                      <img
                        src={processedImage}
                        alt="Processada"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ImageIcon className="h-8 w-8" />
                        <span className="text-sm">Aguardando processamento</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Processing Status */}
              {isProcessing && processingStatus && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{processingStatus}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Trocar Imagem
                </Button>

                <Button
                  onClick={handleRemoveBackground}
                  disabled={isProcessing || !originalImage}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isProcessing ? 'Processando...' : 'Remover Fundo'}
                </Button>

                {processedImage && (
                  <Button variant="secondary" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar
                  </Button>
                )}

                <Button variant="ghost" onClick={handleReset} disabled={isProcessing}>
                  Limpar
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>⚡ Processamento feito localmente no seu navegador usando WebGPU</p>
          <p>📦 O modelo de IA será baixado na primeira execução (~50MB)</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BackgroundRemover;
