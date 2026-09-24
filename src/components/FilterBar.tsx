import React from 'react';
import { Search, Filter, RotateCcw, ArrowUpDown } from 'lucide-react';
import { FilterOptions } from '../types.ts';

const HDB_TOWNS = [
  'ANG MO KIO',
  'BEDOK',
  'BISHAN',
  'BUKIT BATOK',
  'BUKIT MERAH',
  'BUKIT PANJANG',
  'BUKIT TIMAH',
  'CENTRAL AREA',
  'CHOA CHU KANG',
  'CLEMENTI',
  'GEYLANG',
  'HOUGANG',
  'JURONG EAST',
  'JURONG WEST',
  'KALLANG/WHAMPOA',
  'MARINE PARADE',
  'PASIR RIS',
  'PUNGGOL',
  'QUEENSTOWN',
  'SEMBAWANG',
  'SENGKANG',
  'SERANGOON',
  'TAMPINES',
  'TOA PAYOH',
  'WOODLANDS',
  'YISHUN'
];

const FLAT_TYPES = [
  '2 ROOM',
  '3 ROOM',
  '4 ROOM',
  '5 ROOM',
  'EXECUTIVE',
  'MULTI-GENERATION'
];

interface FilterBarProps {
  filters: FilterOptions;
  onChange: (newFilters: FilterOptions) => void;
  onReset: () => void;
  isLoading: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  onReset,
  isLoading
}) => {
  const handleTownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, town: e.target.value });
  };

  const handleFlatTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, flatType: e.target.value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, searchQuery: e.target.value });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, sort: e.target.value });
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, minPrice: e.target.value });
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...filters, maxPrice: e.target.value });
  };

  const hasActiveFilters =
    Boolean(filters.town) ||
    Boolean(filters.flatType) ||
    Boolean(filters.searchQuery) ||
    Boolean(filters.minPrice) ||
    Boolean(filters.maxPrice) ||
    filters.sort !== 'month desc';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search block, street (e.g. 406 Ang Mo Kio, Tampines St 21)..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50/50"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Town Dropdown */}
          <div className="flex-1 sm:flex-initial min-w-[150px]">
            <select
              value={filters.town}
              onChange={handleTownChange}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            >
              <option value="">All Towns (Islandwide)</option>
              {HDB_TOWNS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Flat Type */}
          <div className="flex-1 sm:flex-initial min-w-[130px]">
            <select
              value={filters.flatType}
              onChange={handleFlatTypeChange}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            >
              <option value="">All Flat Types</option>
              {FLAT_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>

          {/* Min Price */}
          <div className="flex-1 sm:flex-initial min-w-[110px]">
            <select
              value={filters.minPrice}
              onChange={handleMinPriceChange}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            >
              <option value="">Min Price</option>
              <option value="300000">$300k</option>
              <option value="400000">$400k</option>
              <option value="500000">$500k</option>
              <option value="600000">$600k</option>
              <option value="700000">$700k</option>
              <option value="800000">$800k</option>
              <option value="1000000">$1M+</option>
            </select>
          </div>

          {/* Max Price */}
          <div className="flex-1 sm:flex-initial min-w-[110px]">
            <select
              value={filters.maxPrice}
              onChange={handleMaxPriceChange}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            >
              <option value="">Max Price</option>
              <option value="400000">$400k</option>
              <option value="500000">$500k</option>
              <option value="600000">$600k</option>
              <option value="700000">$700k</option>
              <option value="800000">$800k</option>
              <option value="1000000">$1M</option>
              <option value="1500000">$1.5M</option>
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex-1 sm:flex-initial min-w-[140px]">
            <div className="relative">
              <select
                value={filters.sort}
                onChange={handleSortChange}
                className="w-full pl-7 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
              >
                <option value="month desc">Latest Transacted</option>
                <option value="resale_price desc">Price: High to Low</option>
                <option value="resale_price asc">Price: Low to High</option>
                <option value="floor_area_sqm desc">Area: Largest</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && (
            <button
              onClick={onReset}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
