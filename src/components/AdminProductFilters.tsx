import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AdminProductFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  categories: { id: string; name: string }[];
  resultCount: number;
  totalCount: number;
}

const AdminProductFilters = ({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  categories,
  resultCount,
  totalCount,
}: AdminProductFiltersProps) => {
  const hasFilters = searchTerm || categoryFilter !== 'all';

  const clearFilters = () => {
    onSearchChange('');
    onCategoryChange('all');
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-[#12121a] rounded-lg border border-blue-500/20">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300/50" />
        <Input
          placeholder="Buscar produto..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 bg-[#0a0a0f] border-blue-500/30 text-white placeholder:text-blue-300/40 focus:border-blue-500"
        />
      </div>

      {/* Category Filter */}
      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px] bg-[#0a0a0f] border-blue-500/30 text-white">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent className="bg-[#12121a] border-blue-500/30">
          <SelectItem value="all" className="text-white hover:bg-blue-500/20">
            Todas as categorias
          </SelectItem>
          {categories.map((cat) => (
            <SelectItem 
              key={cat.id} 
              value={cat.name}
              className="text-white hover:bg-blue-500/20"
            >
              {cat.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters Button */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-blue-300/70 hover:text-white hover:bg-blue-500/20"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}

      {/* Results Counter */}
      <div className="text-sm text-blue-300/50 ml-auto">
        {resultCount === totalCount ? (
          <span>{totalCount} produto{totalCount !== 1 ? 's' : ''}</span>
        ) : (
          <span>{resultCount} de {totalCount} produto{totalCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </div>
  );
};

export default AdminProductFilters;
