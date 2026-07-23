export interface Item {
    code: string;
    brand: string;
    name: string;
    category: string;
    image: string;
    isMaster: boolean;
    sizes?: string;
    price?: number;
    colorCode?: string;
    description?: string;
    [key: string]: any;
}

export interface InventoryItem {
    color: string;
    size: string;
    qty: number;
}

export interface OutfitItem {
    id?: string;
    code: string;
    host: string;
    size: string;
}

export interface NoteItem {
    id?: string;
    code: string;
    text: string;
}

export interface SupplyItem {
    id?: string;
    code: string;
    text: string;
}

export interface HistoryLog {
    id: string;
    code: string;
    color?: string;
    size?: string;
    type: string;
    qty: number;
    actor: string;
    date: string;
    note?: string;
    // For type 'RETURN': the id of the RENT log this return closes out. This is how
    // "still outstanding" rentals are derived — no separate rentals table.
    ref_id?: number | string | null;
    [key: string]: any;
}

export interface CustomModel {
    id: number;
    name: string;
    url: string;
    height: number | null;
    created_at: string;
}

export interface GalleryItem {
    id: number;
    type: 'vton' | 'sheet' | 'video';
    url: string;
    created_at: string;
}

export interface VtonLayerState {
    type: 'product' | 'prompt';
    url: string;
    prompt?: string;
    id?: string | null;
    item?: any;
    colorCode?: string | null;
    sizeCode?: string | null;
}

export interface BodyAnalysis {
    shoulderWidth: number | null;
    legLength: number | null;
    isAnalyzing: boolean;
}

export interface AppState {
    allItems: Item[];
    allStockMap: Record<string, InventoryItem[]>;
    allOutfits: OutfitItem[];
    allNotes: NoteItem[];
    allSupplies: SupplyItem[];
    allHistory: HistoryLog[];
    allWeather: any;
    selDate: string | null;
    filteredItems: Item[];
    rentalCart: any[];
    isLoading: boolean;
    error: string | null;
    
    // Inventory page filter persistence states
    invSearchTerm: string;
    invSelectedBrand: string;
    invSelectedCate: string;
    invVisibleCount: number;
    
    setAllOutfits: (outfits: OutfitItem[]) => void;
    setAllNotes: (notes: NoteItem[]) => void;
    setAllSupplies: (supplies: SupplyItem[]) => void;
    setAllStockMap: (map: Record<string, InventoryItem[]>) => void;
    setAllHistory: (history: HistoryLog[]) => void;
    setSelDate: (date: string | null) => void;
    setIsLoading: (v: boolean) => void;
    setInvSearchTerm: (v: string) => void;
    setInvSelectedBrand: (v: string) => void;
    setInvSelectedCate: (v: string) => void;
    setInvVisibleCount: (v: number) => void;
    addToCart: (item: any) => void;
    clearCart: () => void;
    
    apiClient: any;
    initApp: () => Promise<void>;
    updateHistoryInBackend: (updatedLogs: any[]) => Promise<void>;
    saveToBackend: (fileName: string, data: any, code: string) => Promise<void>;
    // Returns the saved logs with their backend-assigned ids attached (same order as input),
    // so callers can immediately reference a row (e.g. a RETURN log's ref_id).
    saveHistoryToBackend: (logs: any) => Promise<any[]>;
    saveProductToBackend: (productData: any) => Promise<void>;
}

export interface VtonState {
    allCustomModels: CustomModel[];
    allGallery: GalleryItem[];
    
    // Moved from component state to Zustand
    model: { type: string; url: string };
    top: VtonLayerState;
    bottom: VtonLayerState;
    outer: VtonLayerState;
    targetCodesInput: string;
    targetCodes: string[];
    bodyAnalysis: BodyAnalysis | null;
    
    setModel: (model: { type: string; url: string } | ((prev: { type: string; url: string }) => { type: string; url: string })) => void;
    setTop: (top: VtonLayerState | ((prev: VtonLayerState) => VtonLayerState)) => void;
    setBottom: (bottom: VtonLayerState | ((prev: VtonLayerState) => VtonLayerState)) => void;
    setOuter: (outer: VtonLayerState | ((prev: VtonLayerState) => VtonLayerState)) => void;
    setTargetCodesInput: (v: string) => void;
    setTargetCodes: (v: string[]) => void;
    setBodyAnalysis: (v: BodyAnalysis | null | ((prev: BodyAnalysis | null) => BodyAnalysis | null)) => void;
    
    setAllCustomModels: (models: CustomModel[]) => void;
    setAllGallery: (gallery: GalleryItem[]) => void;
    saveCustomModelToBackend: (name: string, url: string, height: number | string) => Promise<void>;
    saveGalleryToBackend: (gType: string, url: string) => Promise<void>;
    deleteGalleryFromBackend: (id: number) => Promise<void>;
}

