export interface HDBRecord {
  _id: number;
  month: string;
  town: string;
  flat_type: string;
  block: string;
  street_name: string;
  storey_range: string;
  floor_area_sqm: number;
  flat_model: string;
  lease_commence_date: string;
  remaining_lease: string;
  resale_price: number;
  price_per_sqm: number;
  latitude?: number;
  longitude?: number;
}

export interface HDBApiResponse {
  success: boolean;
  total: number;
  limit: number;
  offset: number;
  count: number;
  median_price: number;
  average_price: number;
  min_price: number;
  max_price: number;
  median_psm: number;
  records: HDBRecord[];
  error?: string;
}

export interface GeocodeResult {
  searchVal: string;
  block: string;
  roadName: string;
  building: string;
  address: string;
  postal: string;
  latitude: number;
  longitude: number;
  x?: number;
  y?: number;
}

export interface FilterOptions {
  town: string;
  flatType: string;
  searchQuery: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
}
