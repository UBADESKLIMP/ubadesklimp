/**
 * Foto de celular passa fácil de 5 MB. Reduz para no máximo 1600 px no lado maior e JPEG,
 * que é de sobra para a IA ler um print ou uma lista, e cabe no envio.
 */
export const imagemParaBase64 = async (arquivo: File, maxLado = 1600): Promise<{ mime: string; base64: string }> => {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * escala));
  canvas.height = Math.max(1, Math.round(bmp.height * escala));
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.82);
  return { mime: 'image/jpeg', base64: url.split(',')[1] ?? '' };
};
