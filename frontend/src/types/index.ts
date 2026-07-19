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

export interface RentalItem {
    id?: string;
    code: string;
    renter: string;
    color: string;
    size: string;
    qty: number;
    date: string;
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

export interface AppState {
    allItems: Item[];
    allStockMap: Record<string, InventoryItem[]>;
    allRentals: RentalItem[];
    allOutfits: OutfitItem[];
    allNotes: NoteItem[];
    allSupplies: SupplyItem[];
    allHistory: HistoryLog[];
    allWeather: any;
    selDate: Date | null;
    filteredItems: Item[];
    isLoading: boolean;
    invSearchTerm: string;
    invFilterCategory: string;
    invFilterStock: string;
    
    initApp: () => Promise<void>;
    setAllItems: (items: Item[]) => void;
    setFilteredItems: (items: Item[]) => void;
    setAllRentals: (rentals: RentalItem[]) => void;
    setAllOutfits: (outfits: OutfitItem[]) => void;
    setAllNotes: (notes: NoteItem[]) => void;
    setAllSupplies: (supplies: SupplyItem[]) => void;
    setAllStockMap: (map: Record<string, InventoryItem[]>) => void;
    setAllHistory: (history: HistoryLog[]) => void;
    setSelDate: (date: Date | null) => void;
    setIsLoading: (v: boolean) => void;
    setInvSearchTerm: (v: string) => void;
    setInvFilterCategory: (v: string) => void;
    setInvFilterStock: (v: string) => void;
    
    updateHistoryInBackend: (updatedLogs: HistoryLog[]) => Promise<void>;
    saveToGitHub: (fileName: string, data: any) => Promise<any>;
    saveHistoryToBackend: (logs: any) => Promise<void>;
    saveProductToBackend: (productData: any, newLogs: any) => Promise<void>;
    [key: string]: any;
}

export interface VtonState {
    allCustomModels: CustomModel[];
    allGallery: GalleryItem[];
    
    setAllCustomModels: (models: CustomModel[]) => void;
    setAllGallery: (gallery: GalleryItem[]) => void;
    saveCustomModelToBackend: (name: string, url: string, height: number | string) => Promise<void>;
    saveGalleryToBackend: (gType: string, url: string) => Promise<void>;
    deleteGalleryFromBackend: (id: number) => Promise<void>;
    [key: string]: any;
}
