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
  allHistory: [],
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
  setAllHistory: (history) => set({ allHistory: history }),
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

  // Save history to backend
  saveHistoryToBackend: async (newHistoryLogs) => {
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_history', data: newHistoryLogs })
      });
      if (!response.ok) throw new Error('Failed to save history');
      
      // Update local state by appending
      set(state => ({ allHistory: [...state.allHistory, ...newHistoryLogs] }));
    } catch (e) {
      console.error('Error saving history:', e);
      throw e;
    }
  },

  // Update existing history logs and auto-sync inventory locally
  updateHistoryInBackend: async (updatedLogs) => {
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'update_history', data: updatedLogs })
      });
      if (!response.ok) throw new Error('Failed to update history');

      set(state => {
        // 1. Update allHistory
        const newHistory = [...state.allHistory];
        const stockMap = { ...state.allStockMap };
        
        updatedLogs.forEach(updatedLog => {
          const idx = newHistory.findIndex(h => h.id === updatedLog.id);
          if (idx !== -1) {
             newHistory[idx] = { ...newHistory[idx], qty: updatedLog.qty, date: updatedLog.date, note: updatedLog.note };
          }
          
          // 2. Sync local stockMap with deltaQty
          if (updatedLog.deltaQty !== 0) {
            const { code, color, size, deltaQty } = updatedLog;
            if (stockMap[code]) {
               const itemIdx = stockMap[code].findIndex(i => i.color === color && i.size === size);
               if (itemIdx !== -1) {
                  const items = [...stockMap[code]];
                  items[itemIdx] = { ...items[itemIdx], qty: Number(items[itemIdx].qty) + deltaQty };
                  stockMap[code] = items;
               } else {
                  stockMap[code] = [...stockMap[code], { color, size, qty: deltaQty }];
               }
            } else {
               stockMap[code] = [{ color, size, qty: deltaQty }];
            }
          }
        });

        return { allHistory: newHistory, allStockMap: stockMap };
      });
    } catch (e) {
      console.error('Error updating history:', e);
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
      const history = backendData.history || [];
      
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
        allHistory: history,
        allWeather: weather,
        isLoading: false 
      });
    } catch (error) {
      console.error('Initialization error:', error);
      set({ error: 'Failed to load data', isLoading: false });
    }
  },
}));
