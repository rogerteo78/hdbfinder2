import React from 'react';
import { TrendingUp, DollarSign, Ruler, Building2, BarChart3 } from 'lucide-react';
import { HDBApiResponse } from '../types.ts';

interface AnalyticsProps {
  data: HDBApiResponse | null;
  isLoading: boolean;
}

export const Analytics: React.FC<AnalyticsProps> = ({ data, isLoading }) => {
  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
            <div className="h-7 bg-slate-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.count === 0) {
    return null;
  }

  const formatPrice = (val: number) => `$${val.toLocaleString()}`;

  return (
    <div className="space-y-4 mb-6">
      {/* Top summary KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Median Price */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">Median Resale Price</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatPrice(data.median_price)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>Self-calculated median across results</span>
          </div>
        </div>

        {/* Average Price */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">Average Price</span>
            <BarChart3 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatPrice(data.average_price)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sample of {data.count} recent records
          </div>
        </div>

        {/* Median Price / sqm */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">Median / m²</span>
            <Ruler className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {formatPrice(data.median_psm)}
            <span className="text-xs font-normal text-slate-500 ml-1">/m²</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ~${Math.round(data.median_psm / 10.764).toLocaleString()} per sq ft
          </div>
        </div>

        {/* Price Range */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold tracking-wide uppercase">Price Range</span>
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {formatPrice(data.min_price)} - {formatPrice(data.max_price)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min to max in current view
          </div>
        </div>
      </div>
    </div>
  );
};
