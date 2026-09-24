import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Building, Map as MapIcon, BarChart2, RefreshCw, AlertCircle } from 'lucide-react';
import { HDBRecord, HDBApiResponse, FilterOptions } from './types.ts';
import { FilterBar } from './components/FilterBar.tsx';
import { Analytics } from './components/Analytics.tsx';
import { HDBMap } from './components/Map.tsx';
import { TransactionList } from './components/TransactionList.tsx';
import { Footer } from './components/Footer.tsx';
import { GeminiChatbot } from './components/GeminiChatbot.tsx';

export default function App() {
  const [data, setData] = useState<HDBApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterOptions>({
    town: '',
    flatType: '',
    searchQuery: '',
    minPrice: '',
    maxPrice: '',
    sort: 'month desc'
  });

  const [selectedRecord, setSelectedRecord] = useState<HDBRecord | null>(null);
  const [geocodedLocations, setGeocodedLocations] = useState<
    Map<string, { lat: number; lng: number; address: string }>
  >(new Map());
  const [isLoadingGeocode, setIsLoadingGeocode] = useState<boolean>(false);

  // Fetch HDB transaction records strictly from our /api/hdb backend route
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('sort', filters.sort);

      if (filters.town) params.set('town', filters.town);
      if (filters.flatType) params.set('flat_type', filters.flatType);
      if (filters.searchQuery) params.set('q', filters.searchQuery);

      const response = await fetch(`/api/hdb?${params.toString()}`);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `Server responded with status ${response.status}`);
      }

      const result: HDBApiResponse = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch HDB resale data.');
    } finally {
      setIsLoading(false);
    }
  }, [filters.town, filters.flatType, filters.searchQuery, filters.sort]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Client-side price range filtering if selected
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    let recs = [...data.records];

    const minP = filters.minPrice ? Number(filters.minPrice) : 0;
    const maxP = filters.maxPrice ? Number(filters.maxPrice) : Infinity;

    if (minP > 0 || maxP < Infinity) {
      recs = recs.filter((r) => r.resale_price >= minP && r.resale_price <= maxP);
    }

    return recs;
  }, [data?.records, filters.minPrice, filters.maxPrice]);

  // Geocode unique addresses via our /api/geocode route (up to 30 visible blocks to keep responsive)
  useEffect(() => {
    if (filteredRecords.length === 0) return;

    let isMounted = true;
    const uniqueKeys = Array.from(
      new Set(
        filteredRecords.slice(0, 30).map((r) => `${r.block} ${r.street_name}`.trim().toUpperCase())
      )
    );

    // Identify which ones are not yet cached in state
    const missing = uniqueKeys.filter((k) => !geocodedLocations.has(k));
    if (missing.length === 0) return;

    setIsLoadingGeocode(true);

    const resolveAddresses = async () => {
      const newGeocodes = new Map(geocodedLocations);

      for (const address of missing) {
        if (!isMounted) break;
        try {
          const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
          if (res.ok) {
            const geocodeData = await res.json();
            if (geocodeData.results && geocodeData.results.length > 0) {
              const top = geocodeData.results[0];
              if (
                typeof top.latitude === 'number' &&
                !isNaN(top.latitude) &&
                typeof top.longitude === 'number' &&
                !isNaN(top.longitude)
              ) {
                newGeocodes.set(address, {
                  lat: top.latitude,
                  lng: top.longitude,
                  address: top.address || address
                });
              }
            }
          }
        } catch {
          // Ignore individual geocode errors gracefully
        }
      }

      if (isMounted) {
        setGeocodedLocations(new Map(newGeocodes));
        setIsLoadingGeocode(false);
      }
    };

    resolveAddresses();

    return () => {
      isMounted = false;
    };
  }, [filteredRecords]);

  const handleResetFilters = () => {
    setFilters({
      town: '',
      flatType: '',
      searchQuery: '',
      minPrice: '',
      maxPrice: '',
      sort: 'month desc'
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
                Singapore HDB Resale Explorer
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Open Data Analysis &bull; OneMap Geospatial Integration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Official Datastore
            </span>

            <button
              onClick={() => fetchTransactions()}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Error notification */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">Notice:</span> {error}
            </div>
            <button
              onClick={() => fetchTransactions()}
              className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onReset={handleResetFilters}
          isLoading={isLoading}
        />

        {/* Analytics KPI metrics cards */}
        <Analytics data={data} isLoading={isLoading} />

        {/* Map & Listings Layout */}
        <div className="space-y-6">
          {/* Geospatial Map */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-sm text-slate-800">
                  Interactive Spatial Map (OneMap)
                </h2>
              </div>
              <span className="text-[11px] text-slate-500">
                {geocodedLocations.size} blocks geocoded
              </span>
            </div>

            <HDBMap
              records={filteredRecords}
              geocodedLocations={geocodedLocations}
              selectedRecord={selectedRecord}
              onSelectRecord={setSelectedRecord}
              isLoadingGeocode={isLoadingGeocode}
            />
          </div>

          {/* Transactions List / Grid */}
          <TransactionList
            records={filteredRecords}
            onSelectRecord={setSelectedRecord}
            selectedRecord={selectedRecord}
            isLoading={isLoading}
            geocodedLocations={geocodedLocations}
          />
        </div>
      </main>

      {/* Mandatory Attribution and Academic Project Disclaimer Footer */}
      <Footer />

      {/* Floating Gemini Chatbot Avatar at bottom right */}
      <GeminiChatbot currentFilters={filters} currentData={data} />
    </div>
  );
}
