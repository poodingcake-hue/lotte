import { create } from 'zustand';
import { VtonState } from '../types';
import { apiClient } from '../api/client';

const resolveState = <T>(val: T | ((prev: T) => T), current: T): T => {
  return typeof val === 'function' ? (val as Function)(current) : val;
};

export const useVtonStore = create<VtonState>((set, get) => ({
  allCustomModels: [],
  allGallery: [],
  
  // Moved states from VtonPage to Zustand
  model: { type: 'preset', url: '' },
  top: { type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' },
  bottom: { type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' },
  outer: { type: 'product', url: '', prompt: '', id: null, item: null, colorCode: '', sizeCode: '' },
  targetCodesInput: '',
  targetCodes: [],
  bodyAnalysis: null,

  setModel: (model) => set((state) => ({ model: resolveState(model, state.model) })),
  setTop: (top) => set((state) => ({ top: resolveState(top, state.top) })),
  setBottom: (bottom) => set((state) => ({ bottom: resolveState(bottom, state.bottom) })),
  setOuter: (outer) => set((state) => ({ outer: resolveState(outer, state.outer) })),
  setTargetCodesInput: (v) => set({ targetCodesInput: v }),
  setTargetCodes: (v) => set({ targetCodes: v }),
  setBodyAnalysis: (bodyAnalysis) => set((state) => ({ bodyAnalysis: resolveState(bodyAnalysis, state.bodyAnalysis) })),
  
  setAllCustomModels: (models) => set({ allCustomModels: models }),
  setAllGallery: (gallery) => set({ allGallery: gallery }),

  saveCustomModelToBackend: async (name, url, height) => {
    try {
      const response = await apiClient.post('', {
        type: 'save_model',
        data: { name, url, height: height ? Number(height) : null }
      });
      if (response.status !== 200) throw new Error('Failed to save model');
      
      // Update local state by prepending
      set(state => ({ allCustomModels: [{ id: Date.now(), name, url, height: height ? Number(height) : null, created_at: new Date().toISOString() }, ...state.allCustomModels] } as Partial<VtonState>));
    } catch (e) {
      console.error('Error saving model:', e);
      throw e;
    }
  },

  saveGalleryToBackend: async (gType, url) => {
    try {
      const response = await apiClient.post('', {
        type: 'save_gallery',
        data: { type: gType, url }
      });
      if (response.status !== 200) throw new Error('Failed to save gallery');
      
      // Update local state by prepending
      set(state => ({ allGallery: [{ id: Date.now(), type: gType, url, created_at: new Date().toISOString() }, ...state.allGallery] } as Partial<VtonState>));
    } catch (e) {
      console.error('Error saving gallery:', e);
      throw e;
    }
  },

  deleteGalleryFromBackend: async (id) => {
    try {
      const response = await apiClient.post('', {
        type: 'delete_gallery',
        data: { id }
      });
      if (response.status !== 200) throw new Error('Failed to delete gallery item');
      
      set(state => ({ allGallery: state.allGallery.filter(item => item.id !== id) } as Partial<VtonState>));
    } catch (e) {
      console.error('Error deleting gallery item:', e);
      throw e;
    }
  }
}));

