/*
 * =====================================================
 * frontend/src/stores/labStore.js (FIXED - No Caching)
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useLabStore = create((set, get) => ({
  labs: [],
  labSummary: null,
  isLoading: false,
  error: null,

  // Fetch labs - REMOVED ALL CACHING LOGIC
  fetchLabs: async (filters = {}, force = false) => {
    const state = get();
    
    // Only prevent multiple simultaneous calls
    if (state.isLoading) {
      console.log('⏳ Lab fetch already in progress');
      return { success: true, data: state.labs };
    }

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.institute) params.append("institute", filters.institute);
      if (filters.department) params.append("department", filters.department);

      console.log('📡 Fetching labs with filters:', filters);
      const response = await api.get(`/labs?${params.toString()}`);
      console.log('✅ Labs fetched:', response.data.data.length, 'labs');
      
      set({
        labs: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch labs";
      console.error('❌ Failed to fetch labs:', errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },

  // Fetch summary for a single lab
  fetchLabSummary: async (labId) => {
    set({ isLoading: true, error: null, labSummary: null });
    try {
      console.log('📡 Fetching lab summary for:', labId);
      const response = await api.get(`/labs/${labId}/summary`);
      console.log('✅ Lab summary fetched');
      
      set({
        labSummary: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch lab summary";
      console.error('❌ Failed to fetch lab summary:', errorMessage);
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw new Error(errorMessage);
    }
  },
  
  clearLabSummary: () => {
    set({ labSummary: null });
  },

  // Create a new lab
  createLab: async (data) => {
    const state = get();
    
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Creating new lab:', data.name);
      const response = await api.post("/labs", data);
      console.log('✅ Lab created successfully');
      
      set((state) => ({
        labs: [response.data.data, ...state.labs],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        "Failed to create lab";
      console.error('❌ Failed to create lab:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Update a lab
  updateLab: async (labId, data) => {
    const state = get();
    
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Updating lab:', labId);
      const response = await api.put(`/labs/${labId}`, data);
      console.log('✅ Lab updated successfully');
      
      set((state) => ({
        labs: state.labs.map((lab) =>
          lab.labId === labId ? response.data.data : lab
        ),
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        "Failed to update lab";
      console.error('❌ Failed to update lab:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Delete a lab
  deleteLab: async (labId) => {
    const state = get();
    
    if (state.isLoading) {
      throw new Error("An operation is already in progress");
    }

    set({ isLoading: true, error: null });
    try {
      console.log('📡 Deleting lab:', labId);
      await api.delete(`/labs/${labId}`);
      console.log('✅ Lab deleted successfully');
      
      set((state) => ({
        labs: state.labs.filter((lab) => lab.labId !== labId),
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to delete lab";
      console.error('❌ Failed to delete lab:', errorMessage);
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));