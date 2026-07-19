import { create } from 'zustand';
import { VtonState } from '../types';

const GAS_WEB_APP_URL = 'https://lotte-backend.poodingcake.workers.dev';

export const useVtonStore = create<VtonState>((set, get) => ({
  allCustomModels: [],
  allGallery: [],
  
  setAllCustomModels: (models) => set({ allCustomModels: models }),
  setAllGallery: (gallery) => set({ allGallery: gallery }),

  saveCustomModelToBackend: async (name, url, height) => {
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_model', data: { name, url, height: height ? Number(height) : null } })
      });
      if (!response.ok) throw new Error('Failed to save model');
      
      // Update local state by prepending
      set(state => ({ allCustomModels: [{ id: Date.now(), name, url, height: height ? Number(height) : null, created_at: new Date().toISOString() }, ...state.allCustomModels] }));
    } catch (e) {
      console.error('Error saving model:', e);
      throw e;
    }
  },

  saveGalleryToBackend: async (gType, url) => {
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'save_gallery', data: { type: gType, url } })
      });
      if (!response.ok) throw new Error('Failed to save gallery');
      
      // Update local state by prepending
      set(state => ({ allGallery: [{ id: Date.now(), type: gType, url, created_at: new Date().toISOString() }, ...state.allGallery] }));
    } catch (e) {
      console.error('Error saving gallery:', e);
      throw e;
    }
  },

  deleteGalleryFromBackend: async (id) => {
    try {
      const response = await fetch(GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'delete_gallery', data: { id } })
      });
      if (!response.ok) throw new Error('Failed to delete gallery item');
      
      set(state => ({ allGallery: state.allGallery.filter(item => item.id !== id) }));
    } catch (e) {
      console.error('Error deleting gallery item:', e);
      throw e;
    }
  }
}));
