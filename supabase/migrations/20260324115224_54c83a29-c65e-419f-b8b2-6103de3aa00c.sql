-- Zerar todas as URLs de imagem para recomeçar do zero
UPDATE products SET image_url = NULL;
UPDATE product_variations SET image_url = NULL;
UPDATE product_fragrances SET image_url = NULL;