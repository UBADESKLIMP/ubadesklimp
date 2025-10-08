-- Adicionar campos para ordenação e variação principal
ALTER TABLE product_variations 
ADD COLUMN is_primary boolean DEFAULT false,
ADD COLUMN display_order integer DEFAULT 0;

-- Adicionar campo de unidade de medida para produtos sem variações
ALTER TABLE products
ADD COLUMN size_unit text DEFAULT 'litros' CHECK (size_unit IN ('litros', 'cm', 'ml', 'kg', 'g', 'unidades'));

-- Criar índice para ordenação
CREATE INDEX idx_product_variations_order ON product_variations(product_id, display_order);

-- Comentários
COMMENT ON COLUMN product_variations.is_primary IS 'Define se esta é a variação principal (padrão)';
COMMENT ON COLUMN product_variations.display_order IS 'Ordem de exibição da variação';
COMMENT ON COLUMN products.size_unit IS 'Unidade de medida para produtos sem variações: litros, cm, ml, kg, g, unidades';