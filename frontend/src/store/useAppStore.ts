import { create } from 'zustand';
import { apiClient } from '../api/client';
import { useVtonStore } from './useVtonStore';
import { AppState } from '../types';


export const useAppStore = create<AppState>((set, get) => ({
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

  // Inventory page filter persistence states
  invSearchTerm: '',
  invSelectedBrand: '',
  invSelectedCate: '',
  invVisibleCount: 40,

  // Setters for mutable arrays (for optimistic updates in DetailPage, etc.)
  setAllRentals: (rentals) => set({ allRentals: rentals }),
  setAllOutfits: (outfits) => set({ allOutfits: outfits }),
  setAllNotes: (notes) => set({ allNotes: notes }),
  setAllSupplies: (supplies) => set({ allSupplies: supplies }),
  setAllStockMap: (map) => set({ allStockMap: map }),
  setAllHistory: (history) => set({ allHistory: history }),
  setSelDate: (date) => set({ selDate: date }),
  setIsLoading: (v) => set({ isLoading: v }),
  setInvSearchTerm: (v) => set({ invSearchTerm: v }),
  setInvSelectedBrand: (v) => set({ invSelectedBrand: v }),
  setInvSelectedCate: (v) => set({ invSelectedCate: v }),
  setInvVisibleCount: (v) => set({ invVisibleCount: v }),
  addToCart: (item) => set((state) => ({ rentalCart: [...state.rentalCart, item] })),
  clearCart: () => set({ rentalCart: [] }),
  
  // Expose apiClient for use in components
  apiClient,

  // Save to backend D1 database
  saveToBackend: async (fileName: string, data: any, productCode: string) => {
    const typeMap: Record<string, string> = {
      'rentals.json': 'save_product_rentals',
      'outfits.json': 'save_product_outfits',
      'notes.json': 'save_note',
      'supplies.json': 'save_supply'
    };

    try {
      let payload: any = null;
      
      if (fileName === 'notes.json') {
        const note = data.find((n: any) => String(n.code) === String(productCode));
        payload = { code: productCode, text: note ? note.text : '' };
      } else if (fileName === 'supplies.json') {
        const supply = data.find((s: any) => String(s.code) === String(productCode));
        payload = { code: productCode, text: supply ? supply.text : '' };
      } else if (fileName === 'outfits.json') {
        const outfits = data.filter((o: any) => String(o.code) === String(productCode));
        payload = { code: productCode, outfits };
      } else if (fileName === 'rentals.json') {
        const rentals = data.filter((r: any) => String(r.code) === String(productCode));
        payload = { code: productCode, rentals };
      }

      await apiClient.post('', { type: typeMap[fileName], data: payload });
    } catch (e) {
      console.error(`Error saving ${fileName}:`, e);
      throw e;
    }
  },

  // Save product to backend (Optimized to save only single product)
  saveProductToBackend: async (newProduct: any) => {
    try {
      await apiClient.post('', { type: 'save_product', data: newProduct });
      
      // Update local state
      set(state => {
         const filtered = state.allItems.filter(p => String(p.code) !== String(newProduct.code));
         return { allItems: [...filtered, newProduct] };
      });
    } catch (e) {
      console.error('Error saving product:', e);
      throw e;
    }
  },

  saveHistoryToBackend: async (newHistoryLogs: any) => {
    try {
      await apiClient.post('', { type: 'save_history', data: newHistoryLogs });
      // Update local state by appending
      set(state => ({ allHistory: [...state.allHistory, ...newHistoryLogs] }));
    } catch (e) {
      console.error('Error saving history:', e);
      throw e;
    }
  },

  // Update existing history logs and auto-sync inventory locally
  updateHistoryInBackend: async (updatedLogs: any) => {
    try {
      await apiClient.post('', { type: 'update_history', data: updatedLogs });

      set(state => {
        // 1. Update allHistory
        const newHistory = [...state.allHistory];
        const stockMap = { ...state.allStockMap };
        
        updatedLogs.forEach((updatedLog: any) => {
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
      
      // 1. Fetch Master Data from public/data.json (local fetch is correct)
      const baseUrl = import.meta.env.BASE_URL;
      const masterRes = await fetch(`${baseUrl}data.json?v=${ts}`);
      const masterData = await masterRes.json();

      // 2. Fetch Backend Data (Cloudflare Worker via apiClient)
      const backendRes = await apiClient.get(`?action=getAll&v=${ts}`);
      const backendData = backendRes.data;

      const rentals = backendData.rentals || [];
      const outfits = backendData.outfits || [];
      const notes = backendData.notes || [];
      const supplies = backendData.supplies || [];
      const history = backendData.history || [];
      const customModels = backendData.custom_models || [];
      const gallery = backendData.gallery || [];
      
      
      const finalInventory: Record<string, any> = {};
      
      if (history.length > 0) {
        // ALWAYS reconstruct inventory dynamically from history to bypass backend inventory duplicate bugs
        const tempInv: Record<string, Record<string, number>> = {};
        history.forEach((log: any) => {
          const c = String(log.code);
          if (!tempInv[c]) tempInv[c] = {};
          const key = `${log.color}_${log.size}`;
          if (!tempInv[c][key]) tempInv[c][key] = 0;
          tempInv[c][key] += (Number(log.qty) || 0);
        });

        Object.keys(tempInv).forEach(code => {
          finalInventory[code] = Object.keys(tempInv[code]).map(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const color = key.substring(0, lastUnderscore);
            const size = key.substring(lastUnderscore + 1);
            return { color, size, qty: tempInv[code][key] };
          });
        });
      } else {
        // Fallback to raw inventory if history is completely empty
        const rawInventory = (backendData.inventory || {}) as Record<string, any>;
        Object.keys(rawInventory).forEach(code => {
          const items = rawInventory[code];
          if (Array.isArray(items)) {
            const map: Record<string, number> = {};
            items.forEach((item: any) => {
              const key = `${item.color}_${item.size}`;
              map[key] = (Number(item.qty) || 0);
            });
            finalInventory[code] = Object.keys(map).map(key => {
              const lastUnderscore = key.lastIndexOf('_');
              const color = key.substring(0, lastUnderscore);
              const size = key.substring(lastUnderscore + 1);
              return { color, size, qty: map[key] };
            });
          }
        });
      }
      
      let allItems = [];
      const schedules = (masterData.items || []).filter((i: any) => !i.isMaster);
      const originalMasters = (masterData.items || []).filter((i: any) => i.isMaster);
      const backendProducts = backendData.products || [];

      // Merge backend products with original masters (backend products take precedence)
      const backendProdKeys = new Set(backendProducts.map((p: any) => String(p.code)));
      const remainingOriginalMasters = originalMasters.filter((m: any) => !backendProdKeys.has(String(m.code)));
      
      const combinedMasters = [...remainingOriginalMasters, ...backendProducts];
      const allMasterKeys = new Set(combinedMasters.map(m => String(m.code)));
      
      // Find orphans (in inventory but no master info)
      const orphanCodes = Object.keys(finalInventory).filter(k => !allMasterKeys.has(String(k)));
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

      // Update VtonStore separately
      useVtonStore.getState().setAllCustomModels(customModels);
      useVtonStore.getState().setAllGallery(gallery);

      set({ 
        allItems,
        allStockMap: finalInventory,
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
