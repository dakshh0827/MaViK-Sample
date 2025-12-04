/*
 * =====================================================
 * frontend/src/stores/instituteStore.js (FIXED - No Caching)
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useInstituteStore = create((set, get) => ({
  institutes: [],
  isLoading: false,
  error: null,

  // Fetch all institutes - REMOVED ALL CACHING LOGIC
  fetchInstitutes: async (force = false) => {
    const state = get();
    
    // Only prevent multiple simultaneous calls
    if (state.isLoading) {
      console.log('⏳ Institute fetch already in progress');
      return { success: true, data: state.institutes };
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Fetching institutes...');
      const response = await api.get("/institutes");
      console.log('✅ Institutes fetched:', response.data.data.length, 'institutes');
      
      set({
        institutes: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch institutes";
      console.error('❌ Failed to fetch institutes:', errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Create a new institute
  createInstitute: async (data) => {
    const state = get();
    
    // Prevent duplicate calls
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Creating new institute:', data.name);
      const response = await api.post("/institutes", data);
      console.log('✅ Institute created successfully');
      
      set((state) => ({
        institutes: [...state.institutes, response.data.data].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to create institute";
      console.error('❌ Failed to create institute:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Update an institute
  updateInstitute: async (instituteId, name) => {
    const state = get();
    
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Updating institute:', instituteId);
      const response = await api.put(`/institutes/${instituteId}`, { name });
      console.log('✅ Institute updated successfully');
      
      set((state) => ({
        institutes: state.institutes
          .map((inst) => (inst.instituteId === instituteId ? response.data.data : inst))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to update institute";
      console.error('❌ Failed to update institute:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Delete an institute
  deleteInstitute: async (instituteId) => {
    const state = get();
    
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Deleting institute:', instituteId);
      await api.delete(`/institutes/${instituteId}`);
      console.log('✅ Institute deleted successfully');
      
      set((state) => ({
        institutes: state.institutes.filter((inst) => inst.instituteId !== instituteId),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to delete institute";
      console.error('❌ Failed to delete institute:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));