import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const BUCKET = 'product-images';
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.85;

// Redimensiona pro maior lado caber em MAX_DIMENSION e reencoda em WebP —
// fotos de produto vêm de celular (3-15MB) e não precisam de mais que isso
// pra ficar nítidas no site. WebP (não JPEG) porque muita foto já vem com
// fundo removido (transparente); JPEG não tem canal alfa e preencheria a
// transparência de preto ao exportar.
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D não suportado'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem comprimida'))),
        'image/webp',
        WEBP_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler a imagem'));
    };
    img.src = objectUrl;
  });
};

export const useImageUpload = () => {
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file) return null;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive"
      });
      return null;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 15MB.",
        variant: "destructive"
      });
      return null;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, compressed, { contentType: 'image/webp', cacheControl: '31536000' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer upload da imagem.",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadImageFromUrl = async (url: string): Promise<string | null> => {
    if (!url) return null;

    setUploading(true);
    try {
      const { data, error } = await supabase.functions.invoke('upload-image-from-url', {
        body: { url },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Resposta sem URL');

      return data.url as string;
    } catch (error) {
      console.error('Error uploading image from URL:', error);
      toast({
        title: "Não foi possível usar essa foto sugerida",
        description: "Envie uma foto manualmente.",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploadImage, uploadImageFromUrl, uploading };
};
