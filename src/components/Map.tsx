import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from '../lib/leaflet-with-clusters.ts';
import 'leaflet/dist/leaflet.css';
import { Flame, DollarSign, Layers, Eye, EyeOff, Sliders, Boxes } from 'lucide-react';
import { HDBRecord } from '../types.ts';

export type HeatmapMode = 'none' | 'density' | 'psm';

interface MapProps {
  records: HDBRecord[];
  geocodedLocations: Map<string, { lat: number; lng: number; address: string }>;
  selectedRecord: HDBRecord | null;
  onSelectRecord: (record: HDBRecord) => void;
  isLoadingGeocode?: boolean;
}

export const HDBMap: React.FC<MapProps> = ({
  records,
  geocodedLocations,
  selectedRecord,
  onSelectRecord,
  isLoadingGeocode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const regularMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const markerLookupRef = useRef<Map<string, L.Marker>>(new Map());

  // Heatmap and cluster state
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('density');
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [enableClustering, setEnableClustering] = useState<boolean>(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(0.75);

  // Group records by block+street and compute aggregates
  const groupedLocations = useMemo(() => {
    const map = new Map<
      string,
      {
        records: HDBRecord[];
        lat: number;
        lng: number;
        avgPsm: number;
        avgPrice: number;
        count: number;
      }
    >();

    for (const rec of records) {
      const key = `${rec.block} ${rec.street_name}`.trim().toUpperCase();
      const coords = geocodedLocations.get(key);
      if (!coords) continue;

      const { lat, lng } = coords;
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, {
          records: [],
          lat,
          lng,
          avgPsm: 0,
          avgPrice: 0,
          count: 0
        });
      }

      map.get(key)!.records.push(rec);
    }

    // Compute averages
    map.forEach((item) => {
      item.count = item.records.length;
      const sumPsm = item.records.reduce((acc, r) => acc + r.price_per_sqm, 0);
      const sumPrice = item.records.reduce((acc, r) => acc + r.resale_price, 0);
      item.avgPsm = item.count > 0 ? Math.round(sumPsm / item.count) : 0;
      item.avgPrice = item.count > 0 ? Math.round(sumPrice / item.count) : 0;
    });

    return map;
  }, [records, geocodedLocations]);

  // Derived statistics for heatmap coloring & legends
  const stats = useMemo(() => {
    let maxCount = 1;
    let minPsm = Infinity;
    let maxPsm = -Infinity;

    groupedLocations.forEach((item) => {
      if (item.count > maxCount) maxCount = item.count;
      if (item.avgPsm < minPsm) minPsm = item.avgPsm;
      if (item.avgPsm > maxPsm) maxPsm = item.avgPsm;
    });

    if (minPsm === Infinity) minPsm = 4000;
    if (maxPsm === -Infinity) maxPsm = 10000;
    if (maxPsm <= minPsm) maxPsm = minPsm + 1000;

    return { maxCount, minPsm, maxPsm };
  }, [groupedLocations]);

  // Pre-generate 256-color gradient palettes
  const palettes = useMemo(() => {
    const makePalette = (stops: [number, string][]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const grad = ctx.createLinearGradient(0, 0, 256, 0);
      stops.forEach(([pos, col]) => grad.addColorStop(pos, col));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 1);
      return ctx.getImageData(0, 0, 256, 1).data;
    };

    // Density: Blue -> Cyan -> Green -> Yellow -> Orange -> Red
    const densityPalette = makePalette([
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.15, 'rgba(30, 58, 138, 0.4)'],
      [0.3, 'rgba(6, 182, 212, 0.65)'],
      [0.5, 'rgba(34, 197, 94, 0.8)'],
      [0.75, 'rgba(234, 179, 8, 0.9)'],
      [1.0, 'rgba(239, 68, 68, 0.98)']
    ]);

    // Average Price / m²: Emerald (affordable) -> Sky -> Indigo -> Amber -> Rose / Crimson (premium)
    const psmPalette = makePalette([
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.15, 'rgba(16, 185, 129, 0.4)'],
      [0.35, 'rgba(14, 165, 233, 0.65)'],
      [0.6, 'rgba(99, 102, 241, 0.8)'],
      [0.8, 'rgba(245, 158, 11, 0.9)'],
      [1.0, 'rgba(225, 29, 72, 0.98)']
    ]);

    return { density: densityPalette, psm: psmPalette };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center of Singapore
    const initialCenter: L.LatLngExpression = [1.3521, 103.8198];
    const initialZoom = 12;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true
    });

    // Custom bottom-right attribution exactly as OneMap requires:
    // the OneMap logo linked to https://www.onemap.gov.sg and the text "© contributors | Singapore Land Authority"
    const attributionHtml = `<a href="https://www.onemap.gov.sg" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;vertical-align:middle;text-decoration:none;"><img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:16px;width:auto;margin-right:4px;" alt="OneMap" /></a> <a href="https://www.onemap.gov.sg" target="_blank" rel="noopener noreferrer" style="color:#0284c7;text-decoration:none;font-weight:500;">OneMap</a> © contributors | Singapore Land Authority`;

    const tileLayer = L.tileLayer('https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 11,
      attribution: attributionHtml
    });

    tileLayer.addTo(map);

    // Marker Cluster Layer setup with high performance and smooth animation
    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      removeOutsideVisibleBounds: true,
      animate: true,
      disableClusteringAtZoom: 17, // Show separate markers when zoomed all the way into block level
      iconCreateFunction: (cluster: any) => {
        const childMarkers = cluster.getAllChildMarkers();
        let totalTx = 0;
        let sumPrice = 0;
        let sumPsm = 0;

        for (const m of childMarkers) {
          const data = (m as any).customData;
          if (data) {
            totalTx += data.count || 1;
            sumPrice += (data.avgPrice || 0) * (data.count || 1);
            sumPsm += (data.avgPsm || 0) * (data.count || 1);
          } else {
            totalTx += 1;
          }
        }

        const blocksCount = childMarkers.length;
        const avgClusterPrice = totalTx > 0 ? Math.round(sumPrice / totalTx) : 0;
        const avgClusterPsm = totalTx > 0 ? Math.round(sumPsm / totalTx) : 0;

        let sizeClass = 'cluster-small';
        if (blocksCount >= 15) {
          sizeClass = 'cluster-large';
        } else if (blocksCount >= 6) {
          sizeClass = 'cluster-medium';
        }

        const subtext = `${totalTx} txns`;

        return L.divIcon({
          html: `
            <div class="cluster-bubble ${sizeClass}" title="${blocksCount} blocks clustered, ${totalTx} total transactions, Avg: $${avgClusterPrice.toLocaleString()}, Avg $/m²: $${avgClusterPsm.toLocaleString()}">
              <span>${blocksCount}</span>
              <span class="cluster-subtext">${subtext}</span>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: sizeClass === 'cluster-large' ? [58, 58] : sizeClass === 'cluster-medium' ? [50, 50] : [42, 42],
          iconAnchor: sizeClass === 'cluster-large' ? [29, 29] : sizeClass === 'cluster-medium' ? [25, 25] : [21, 21]
        });
      }
    });

    clusterGroupRef.current = clusterGroup;

    // Regular non-clustered layer group fallback
    const regularLayer = L.layerGroup();
    regularMarkersLayerRef.current = regularLayer;

    // Default to adding clusterGroup to map
    clusterGroup.addTo(map);

    // Create a dedicated heatmap pane over the map markers (zIndex 620)
    // with pointer-events: none so clicks seamlessly pass through to markers and clusters
    const heatmapPane = map.createPane('heatmapPane');
    heatmapPane.style.zIndex = '620';
    heatmapPane.style.pointerEvents = 'none';

    // Create canvas inside heatmapPane
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    heatmapPane.appendChild(canvas);
    heatmapCanvasRef.current = canvas;

    mapInstanceRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
      regularMarkersLayerRef.current = null;
      heatmapCanvasRef.current = null;
    };
  }, []);

  // Render Heatmap on Canvas
  const renderHeatmap = () => {
    const map = mapInstanceRef.current;
    const canvas = heatmapCanvasRef.current;
    if (!map || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (heatmapMode === 'none' || groupedLocations.size === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const size = map.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    // Position canvas exactly at top-left of the map pane
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const zoom = map.getZoom();
    // Dynamic radius based on zoom level: larger on close zoom, compact on wide view
    const radius = Math.round(Math.max(18, Math.min(55, 14 + (zoom - 11) * 6)));

    // Phase 1: Draw radial alpha intensity circles
    groupedLocations.forEach((item) => {
      const containerPoint = map.latLngToContainerPoint([item.lat, item.lng]);
      const x = containerPoint.x;
      const y = containerPoint.y;

      // Skip points far outside viewport buffer
      if (x < -radius * 2 || x > size.x + radius * 2 || y < -radius * 2 || y > size.y + radius * 2) {
        return;
      }

      let intensity = 0.5;
      if (heatmapMode === 'density') {
        // Frequency/volume of transactions
        intensity = Math.min(1.0, Math.max(0.2, item.count / Math.max(stats.maxCount, 1)));
      } else if (heatmapMode === 'psm') {
        // Average Price per square meter (PSM)
        const normalized = (item.avgPsm - stats.minPsm) / (stats.maxPsm - stats.minPsm || 1);
        intensity = Math.min(1.0, Math.max(0.15, normalized));
      }

      ctx.beginPath();
      const radial = ctx.createRadialGradient(x, y, 0, x, y, radius);
      radial.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
      radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radial;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Phase 2: Colorize pixels via selected 256-color palette
    const selectedPalette = heatmapMode === 'density' ? palettes.density : palettes.psm;
    if (!selectedPalette) return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const pIndex = alpha * 4;
          data[i] = selectedPalette[pIndex];
          data[i + 1] = selectedPalette[pIndex + 1];
          data[i + 2] = selectedPalette[pIndex + 2];
          // Apply user opacity slider
          data[i + 3] = Math.round(selectedPalette[pIndex + 3] * heatmapOpacity);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Safe fallback if cross-origin or canvas read error
    }
  };

  // Schedule heatmap redraw on map interactions (drag, zoom, viewreset)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const scheduleRender = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(renderHeatmap);
    };

    map.on('move viewreset resize zoom', scheduleRender);
    scheduleRender();

    return () => {
      map.off('move viewreset resize zoom', scheduleRender);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [heatmapMode, heatmapOpacity, groupedLocations, stats, palettes]);

  // Update Markers & Clusters Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    const regularLayer = regularMarkersLayerRef.current;
    if (!map || !clusterGroup || !regularLayer) return;

    // Reset layers
    clusterGroup.clearLayers();
    regularLayer.clearLayers();
    markerLookupRef.current.clear();

    if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
    if (map.hasLayer(regularLayer)) map.removeLayer(regularLayer);

    if (!showMarkers) {
      return;
    }

    const targetLayer = enableClustering ? clusterGroup : regularLayer;
    targetLayer.addTo(map);

    const bounds: L.LatLngExpression[] = [];
    const markerBatch: L.Marker[] = [];

    groupedLocations.forEach((item, key) => {
      const { records: locRecords, lat, lng, avgPsm, avgPrice } = item;
      bounds.push([lat, lng]);

      const highestPrice = Math.max(...locRecords.map((r) => r.resale_price));
      let badgeColor = 'bg-emerald-600 text-white border-emerald-700';
      if (highestPrice >= 1000000) {
        badgeColor = 'bg-rose-600 text-white border-rose-700';
      } else if (highestPrice >= 800000) {
        badgeColor = 'bg-amber-600 text-white border-amber-700';
      } else if (highestPrice >= 600000) {
        badgeColor = 'bg-indigo-600 text-white border-indigo-700';
      } else if (highestPrice >= 450000) {
        badgeColor = 'bg-sky-600 text-white border-sky-700';
      }

      // If heatmap is active in psm mode, display $/m² on badge, otherwise display price
      const displayLabel =
        heatmapMode === 'psm'
          ? `$${avgPsm.toLocaleString()}/m²`
          : highestPrice >= 1000000
          ? `$${(highestPrice / 1000000).toFixed(2)}M`
          : `$${Math.round(highestPrice / 1000)}k`;

      const icon = L.divIcon({
        className: 'custom-hdb-marker',
        html: `
          <div class="px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-tight shadow-md border flex items-center gap-1 cursor-pointer transition-transform hover:scale-110 ${badgeColor}">
            <span>${displayLabel}</span>
            ${locRecords.length > 1 ? `<span class="opacity-80 text-[9px] bg-black/20 rounded-full px-1">${locRecords.length}</span>` : ''}
          </div>
        `,
        iconSize: [72, 24],
        iconAnchor: [36, 12]
      });

      const marker = L.marker([lat, lng], { icon });

      // Attach custom data for cluster aggregator computations
      (marker as any).customData = {
        key,
        count: locRecords.length,
        avgPsm,
        avgPrice,
        highestPrice,
        records: locRecords
      };

      const firstRec = locRecords[0];

      const popupHtml = `
        <div style="font-family: inherit; min-width: 230px; font-size: 13px; line-height: 1.4; color: #1e293b;">
          <div style="font-weight: 700; font-size: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            ${firstRec.block} ${firstRec.street_name}
          </div>
          <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">
            ${firstRec.town} &bull; ${locRecords.length} transaction${locRecords.length > 1 ? 's' : ''} in view
          </div>
          <div style="background: #f8fafc; border-radius: 6px; padding: 6px 8px; margin-bottom: 8px; font-size: 11px; display: flex; justify-content: space-between;">
            <div><span style="color: #64748b;">Avg Price:</span> <strong>$${avgPrice.toLocaleString()}</strong></div>
            <div><span style="color: #64748b;">Avg $/m²:</span> <strong style="color: #0284c7;">$${avgPsm.toLocaleString()}</strong></div>
          </div>
          <div style="max-height: 140px; overflow-y: auto;">
            ${locRecords
              .slice(0, 4)
              .map(
                (r) => `
              <div style="padding: 4px 0; border-bottom: 1px dashed #f1f5f9; display: flex; justify-content: space-between;">
                <div>
                  <span style="font-weight: 600;">${r.flat_type}</span>
                  <span style="color: #64748b; font-size: 11px;"> (${r.floor_area_sqm} m²)</span>
                  <div style="color: #94a3b8; font-size: 10px;">${r.storey_range} &bull; ${r.month}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: #0284c7;">$${r.resale_price.toLocaleString()}</div>
                  <div style="color: #64748b; font-size: 10px;">$${r.price_per_sqm.toLocaleString()}/m²</div>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => {
        onSelectRecord(firstRec);
      });

      markerBatch.push(marker);
      markerLookupRef.current.set(key, marker);
    });

    if (enableClustering) {
      clusterGroup.addLayers(markerBatch);
    } else {
      markerBatch.forEach((m) => regularLayer.addLayer(m));
    }

    if (bounds.length > 0 && bounds.length <= 35) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 15 });
      } catch {
        // Safe ignore
      }
    }
  }, [groupedLocations, showMarkers, enableClustering, heatmapMode, onSelectRecord]);

  // Center on selected record and uncluster/open popup if triggered externally
  useEffect(() => {
    if (!selectedRecord || !mapInstanceRef.current) return;
    const key = `${selectedRecord.block} ${selectedRecord.street_name}`.trim().toUpperCase();
    const marker = markerLookupRef.current.get(key);
    const clusterGroup = clusterGroupRef.current;

    if (marker && clusterGroup && enableClustering && showMarkers) {
      // Zoom into and spiderfy cluster if the marker is inside a cluster
      clusterGroup.zoomToShowLayer(marker, () => {
        marker.openPopup();
      });
    } else if (marker) {
      const coords = marker.getLatLng();
      mapInstanceRef.current.setView(coords, 16, { animate: true });
      marker.openPopup();
    } else {
      const coords = geocodedLocations.get(key);
      if (coords && !isNaN(coords.lat) && !isNaN(coords.lng)) {
        mapInstanceRef.current.setView([coords.lat, coords.lng], 16, { animate: true });
      }
    }
  }, [selectedRecord, geocodedLocations, enableClustering, showMarkers]);

  return (
    <div className="relative w-full h-[480px] md:h-[540px] rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 flex flex-col">
      {/* Top Map Toolbar: Heatmap, Clustering & Visibility Controls */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[calc(100%-24px)]">
        {/* Heatmap Mode Selector */}
        <div className="bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow border border-slate-200 flex items-center gap-1 text-xs">
          <div className="px-2 py-1 font-semibold text-slate-700 flex items-center gap-1.5 hidden sm:flex border-r border-slate-200">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Layer</span>
          </div>

          <button
            onClick={() => setHeatmapMode('none')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              heatmapMode === 'none'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Markers Only
          </button>

          <button
            onClick={() => setHeatmapMode('density')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              heatmapMode === 'density'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Visualize transaction volume & density"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Transaction Density</span>
          </button>

          <button
            onClick={() => setHeatmapMode('psm')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              heatmapMode === 'psm'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Visualize valuation heatmap by average price per square meter"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Avg Price / m²</span>
          </button>
        </div>

        {/* Marker Clustering Toggle */}
        <button
          onClick={() => setEnableClustering(!enableClustering)}
          className={`bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-xl shadow border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all ${
            enableClustering
              ? 'text-blue-700 bg-blue-50/80 border-blue-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title={
            enableClustering
              ? 'Marker clustering enabled (groups nearby blocks)'
              : 'Clustering disabled (individual block pins)'
          }
        >
          <Boxes className="w-3.5 h-3.5 text-blue-600" />
          <span>Cluster: {enableClustering ? 'On' : 'Off'}</span>
        </button>

        {/* Toggle Markers */}
        <button
          onClick={() => setShowMarkers(!showMarkers)}
          className={`bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-xl shadow border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all ${
            showMarkers ? 'text-slate-800' : 'text-slate-400 bg-slate-50'
          }`}
          title={showMarkers ? 'Hide markers & clusters' : 'Show markers & clusters'}
        >
          {showMarkers ? (
            <>
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>Markers: On</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              <span>Markers: Off</span>
            </>
          )}
        </button>

        {/* Heatmap Opacity Slider (when heatmap active) */}
        {heatmapMode !== 'none' && (
          <div className="bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-xl shadow border border-slate-200 text-xs flex items-center gap-2 text-slate-600 hidden md:flex">
            <Sliders className="w-3 h-3 text-slate-400" />
            <span className="text-[11px]">Opacity</span>
            <input
              type="range"
              min="0.3"
              max="0.95"
              step="0.05"
              value={heatmapOpacity}
              onChange={(e) => setHeatmapOpacity(parseFloat(e.target.value))}
              className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        )}
      </div>

      {/* Geocode Loading Banner */}
      {isLoadingGeocode && (
        <div className="absolute top-16 left-3 z-[1000] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow border border-slate-200 text-xs font-medium text-slate-700 flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Locating blocks on OneMap...</span>
        </div>
      )}

      {/* Interactive Legend (Bottom Left) */}
      <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow border border-slate-200 text-xs max-w-xs pointer-events-auto">
        {heatmapMode === 'density' ? (
          <div>
            <div className="flex items-center justify-between font-semibold text-slate-800 mb-1.5">
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>Transaction Density</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                Max {stats.maxCount} in block
              </span>
            </div>
            {/* Color spectrum gradient */}
            <div className="h-2.5 w-44 rounded-full bg-gradient-to-r from-blue-900 via-cyan-400 via-emerald-400 via-amber-400 to-rose-600 shadow-inner mb-1" />
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Low Activity</span>
              <span>High Activity Hotspot</span>
            </div>
          </div>
        ) : heatmapMode === 'psm' ? (
          <div>
            <div className="flex items-center justify-between font-semibold text-slate-800 mb-1.5">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                <span>Average Price / m²</span>
              </span>
            </div>
            {/* Color spectrum gradient */}
            <div className="h-2.5 w-48 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 via-indigo-500 via-amber-500 to-rose-600 shadow-inner mb-1" />
            <div className="flex justify-between text-[10px] text-slate-600 font-medium">
              <span>${stats.minPsm.toLocaleString()}/m²</span>
              <span>~${Math.round((stats.minPsm + stats.maxPsm) / 2).toLocaleString()}/m²</span>
              <span>${stats.maxPsm.toLocaleString()}/m²</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="font-semibold text-slate-800 mb-1.5">Resale Price Bracket</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span>&lt; $450k</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
                <span>$450k - $650k</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <span>$650k - $850k</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                <span>$850k - $1M</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                <span>&ge; $1M Million Dollar Flats</span>
              </div>
            </div>
          </div>
        )}

        {/* Cluster legend reminder */}
        {enableClustering && showMarkers && (
          <div className="mt-2 pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium text-slate-600">
              <Boxes className="w-3 h-3 text-blue-500" />
              <span>Clustering Active</span>
            </span>
            <span>Click cluster to zoom</span>
          </div>
        )}
      </div>

      {/* Leaflet Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
};
