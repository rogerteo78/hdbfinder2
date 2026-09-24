import React, { useState } from 'react';
import { MapPin, Calendar, Clock, Maximize2, LayoutGrid, List, Layers, X, ExternalLink } from 'lucide-react';
import { HDBRecord } from '../types.ts';

interface TransactionListProps {
  records: HDBRecord[];
  onSelectRecord: (record: HDBRecord) => void;
  selectedRecord: HDBRecord | null;
  isLoading: boolean;
  geocodedLocations: Map<string, { lat: number; lng: number; address: string }>;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  records,
  onSelectRecord,
  selectedRecord,
  isLoading,
  geocodedLocations
}) => {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [modalRecord, setModalRecord] = useState<HDBRecord | null>(null);

  const getPriceBadgeClass = (price: number) => {
    if (price >= 1000000) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (price >= 800000) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (price >= 600000) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (price >= 450000) return 'bg-sky-50 text-sky-700 border-sky-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* List Header & Controls */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800 text-sm md:text-base">
            Recent Transacted Flats
          </h2>
          <p className="text-xs text-slate-500">
            Showing {records.length} past transaction records from data.gov.sg
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${
              viewMode === 'table'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Table view"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${
              viewMode === 'cards'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Card grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">Loading HDB resale data...</p>
          <p className="text-xs text-slate-500">Querying data.gov.sg datastore</p>
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center text-slate-500">
          <p className="text-sm font-medium text-slate-700 mb-1">No transactions match your current filters.</p>
          <p className="text-xs">Try selecting a different town, removing the search query, or expanding the price range.</p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 sticky top-0 z-10 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Address / Block</th>
                <th className="py-3 px-3">Town</th>
                <th className="py-3 px-3">Flat Type</th>
                <th className="py-3 px-3">Floor Area</th>
                <th className="py-3 px-3">Storey Range</th>
                <th className="py-3 px-3">Remaining Lease</th>
                <th className="py-3 px-3">Registration</th>
                <th className="py-3 px-4 text-right">Resale Price</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((rec) => {
                const isSelected = selectedRecord?._id === rec._id;
                const locationKey = `${rec.block} ${rec.street_name}`.trim().toUpperCase();
                const isGeocoded = geocodedLocations.has(locationKey);

                return (
                  <tr
                    key={rec._id}
                    className={`transition-colors hover:bg-slate-50/80 cursor-pointer ${
                      isSelected ? 'bg-blue-50/60 font-medium' : ''
                    }`}
                    onClick={() => {
                      onSelectRecord(rec);
                    }}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">
                        {rec.block} {rec.street_name}
                      </div>
                      <div className="text-[11px] text-slate-500">{rec.flat_model}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{rec.town}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800">{rec.flat_type}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div>{rec.floor_area_sqm} m²</div>
                      <div className="text-[10px] text-slate-400">
                        ~{Math.round(rec.floor_area_sqm * 10.764)} sqft
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{rec.storey_range}</td>
                    <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]">
                      {rec.remaining_lease || `Lease: ${rec.lease_commence_date}`}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{rec.month}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-bold text-slate-900 text-sm">
                        ${rec.resale_price.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ${rec.price_per_sqm.toLocaleString()}/m²
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectRecord(rec)}
                          title={isGeocoded ? 'Focus on OneMap' : 'Locating on Map...'}
                          className={`p-1.5 rounded transition-colors ${
                            isGeocoded
                              ? 'text-blue-600 hover:bg-blue-100'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModalRecord(rec)}
                          title="View Details"
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid View */
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[580px] overflow-y-auto">
          {records.map((rec) => {
            const isSelected = selectedRecord?._id === rec._id;

            return (
              <div
                key={rec._id}
                onClick={() => onSelectRecord(rec)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {rec.block} {rec.street_name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {rec.town} &bull; {rec.flat_model}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getPriceBadgeClass(
                      rec.resale_price
                    )}`}
                  >
                    ${rec.resale_price.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mb-3 pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 block">Flat Type</span>
                    <span className="font-medium text-slate-800">{rec.flat_type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Floor Area</span>
                    <span className="font-medium text-slate-800">{rec.floor_area_sqm} m²</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Storey</span>
                    <span>{rec.storey_range}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Unit Rate</span>
                    <span>${rec.price_per_sqm.toLocaleString()}/m²</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{rec.month}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalRecord(rec);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <span>Details</span>
                    <Maximize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {modalRecord && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalRecord(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalRecord(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                Past Resale Transaction
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                Block {modalRecord.block} {modalRecord.street_name}
              </h3>
              <p className="text-xs text-slate-500">
                {modalRecord.town} Estate &bull; Flat Model: {modalRecord.flat_model}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl mb-4 flex items-baseline justify-between">
              <div>
                <div className="text-xs text-slate-500">Transacted Resale Price</div>
                <div className="text-2xl font-black text-slate-900">
                  ${modalRecord.resale_price.toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Price Per Square Metre</div>
                <div className="text-base font-bold text-blue-600">
                  ${modalRecord.price_per_sqm.toLocaleString()}/m²
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-6">
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Flat Type</span>
                <span className="font-semibold text-slate-800">{modalRecord.flat_type}</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Floor Area</span>
                <span className="font-semibold text-slate-800">
                  {modalRecord.floor_area_sqm} m² ({Math.round(modalRecord.floor_area_sqm * 10.764)} sqft)
                </span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Storey Range</span>
                <span className="font-semibold text-slate-800">{modalRecord.storey_range}</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Registration Month</span>
                <span className="font-semibold text-slate-800">{modalRecord.month}</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Lease Commence Date</span>
                <span className="font-semibold text-slate-800">{modalRecord.lease_commence_date}</span>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <span className="text-slate-400 block mb-0.5">Remaining Lease</span>
                <span className="font-semibold text-slate-800">
                  {modalRecord.remaining_lease || 'Refer to commence date'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onSelectRecord(modalRecord);
                  setModalRecord(null);
                }}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                <span>Show On Map</span>
              </button>
              <button
                onClick={() => setModalRecord(null)}
                className="py-2.5 px-4 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
