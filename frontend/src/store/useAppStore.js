import { create } from 'zustand';
import { fetchWithToken, apiClient, GH_CONFIG } from '../api/client';

const GAS_WEB_APP_URL = 'https://lotte-backend.poodingcake.workers.dev';

export const useAppStore = create((set, get) => ({
  allItems: [],
  allStockMap: {},
  allRentals: [],
  allOutfits: [],
  allNotes: [],
  allSupplies: [],
  allWeather: null,
  selDate: null,
  filteredItems: [],
  rentalCart: [],
  isLoading: false,
  error: null,

  // Setters for mutable arrays (for optimistic updates in DetailPage, etc.)
  setAllRentals: (rentals) => set({ allRentals: rentals }),
  setAllOutfits: (outfits) => set({ allOutfits: outfits }),
  setAllNotes: (notes) => set({ allNotes: notes }),
  setAllSupplies: (supplies) => set({ allSupplies: supplies }),
  setAllStockMap: (map) => set({ allStockMap: map }),
  setSelDate: (date) => set({ selDate: date }),
  setIsLoading: (v) => set({ isLoading: v }),
  addToCart: (item) => set((state) => ({ rentalCart: [...state.rentalCart, item] })),
  clearCart: () => set({ rentalCart: [] }),
  
  // Expose apiClient for use in components
  apiClient,

  // Save to backend D1 database (named saveToGitHub to maintain compatibility)
  saveToGitHub: async (fileName, data) => {
    const typeMap = {
      'rentals.json': 'save_rentals',
      'outfits.json': 'save_outfits',
      'notes.json': 'save_notes',
      'supplies.json': 'save_supplies'
    };

    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: typeMap[fileName], data })
      });

      if (!response.ok) {
        throw new Error('Server error');
      }
    } catch (e) {
      console.error(`Error saving ${fileName}:`, e);
      throw e;
    }
  },

  // Fetch initial data
  initApp: async () => {
    set({ isLoading: true, error: null });
    try {
      const ts = new Date().getTime();
      
      // 1. Fetch Master Data from public/data.json
      const baseUrl = import.meta.env.BASE_URL;
      const masterRes = await fetch(`${baseUrl}data.json?v=${ts}`);
      const masterData = await masterRes.json();

      // 2. Fetch Backend Data (Cloudflare Worker)
      const backendRes = await fetch(GAS_WEB_APP_URL + `?action=getAll&v=${ts}`);
      const backendData = await backendRes.json();

      const rentals = backendData.rentals || [];
      const outfits = backendData.outfits || [];
      const notes = backendData.notes || [];
      const supplies = backendData.supplies || [];
      
      let allItems = [];
      const schedules = (masterData.items || []).filter(i => !i.isMaster);
      const originalMasters = (masterData.items || []).filter(i => i.isMaster);
      const backendProducts = backendData.products || [];

      // Merge backend products with original masters (backend products take precedence)
      const backendProdKeys = new Set(backendProducts.map(p => String(p.code)));
      const remainingOriginalMasters = originalMasters.filter(m => !backendProdKeys.has(String(m.code)));
      
      const combinedMasters = [...remainingOriginalMasters, ...backendProducts];
      const allMasterKeys = new Set(combinedMasters.map(m => String(m.code)));
      
      // Find orphans (in inventory but no master info)
      const orphanCodes = Object.keys(backendData.inventory || {}).filter(k => !allMasterKeys.has(String(k)));
      const dummyProducts = orphanCodes.map(code => ({
          code: code,
          brand: '미등록',
          name: '기본 정보가 없는 상품 (재고만 존재)',
          category: '-',
          image: '',
          isMaster: true
      }));

      allItems = [...combinedMasters, ...dummyProducts, ...schedules];
      
      // 3. Fetch Weather from public/weather.json
      let weather = null;
      try {
        const weatherRes = await fetch(`${baseUrl}weather.json?v=${ts}`);
        if (weatherRes.ok) {
          const wData = await weatherRes.json();
          if (wData && wData.hourly) weather = wData;
        }
      } catch (e) { console.warn('날씨 데이터 로드 실패', e); }

      set({ 
        allItems,
        allStockMap: backendData.inventory || {},
        allRentals: rentals,
        allOutfits: outfits,
        allNotes: notes,
        allSupplies: supplies,
        allWeather: weather,
        isLoading: false 
      });
    } catch (error) {
      console.error('Initialization error:', error);
      set({ error: 'Failed to load data', isLoading: false });
    }
  },
}));
