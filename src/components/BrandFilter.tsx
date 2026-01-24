import { Button } from '@/components/ui/button';

interface BrandFilterProps {
  brands: string[];
  selectedBrand: string | null;
  onSelectBrand: (brand: string | null) => void;
  loading?: boolean;
}

const BrandFilter = ({ 
  brands, 
  selectedBrand, 
  onSelectBrand,
  loading = false 
}: BrandFilterProps) => {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div 
            key={i} 
            className="h-9 w-20 bg-blue-500/10 rounded-md animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (brands.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selectedBrand === null ? "default" : "outline"}
        size="sm"
        onClick={() => onSelectBrand(null)}
        className={
          selectedBrand === null
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:text-white"
        }
      >
        Todas
      </Button>
      
      {brands.map((brand) => (
        <Button
          key={brand}
          variant={selectedBrand === brand ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectBrand(brand)}
          className={
            selectedBrand === brand
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "border-blue-500/30 text-blue-300 hover:bg-blue-500/20 hover:text-white"
          }
        >
          {brand}
        </Button>
      ))}
    </div>
  );
};

export default BrandFilter;
