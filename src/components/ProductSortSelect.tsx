import { ArrowUpDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type PublicSortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'brand_asc';

interface ProductSortSelectProps {
  value: PublicSortOption;
  onChange: (value: PublicSortOption) => void;
  showBrandSort?: boolean;
}

const ProductSortSelect = ({ value, onChange, showBrandSort = false }: ProductSortSelectProps) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PublicSortOption)}>
      <SelectTrigger className="w-[180px] bg-[#12121a] border-blue-500/30 text-white">
        <ArrowUpDown className="h-4 w-4 mr-2 text-blue-400/70" />
        <SelectValue placeholder="Ordenar por" />
      </SelectTrigger>
      <SelectContent className="bg-[#12121a] border-blue-500/30 z-50">
        <SelectItem value="default" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
          Ordem padrão
        </SelectItem>
        <SelectItem value="price_asc" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
          Menor preço
        </SelectItem>
        <SelectItem value="price_desc" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
          Maior preço
        </SelectItem>
        <SelectItem value="name_asc" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
          A-Z
        </SelectItem>
        <SelectItem value="name_desc" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
          Z-A
        </SelectItem>
        {showBrandSort && (
          <SelectItem value="brand_asc" className="text-white hover:bg-blue-500/20 focus:bg-blue-500/20">
            Por marca
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
};

export default ProductSortSelect;
