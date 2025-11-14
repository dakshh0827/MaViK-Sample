/*
 * =====================================================
 * frontend/src/stores/labStore.js (FIXED)
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useLabStore = create((set, get) => ({
  labs: [],
  labSummary: null,
  isLoading: false,
  error: null,
  lastFetch: null,

  // Fetch labs
  fetchLabs: async (filters = {}, force = false) => {
    const state = get();
    
    // Prevent multiple simultaneous calls
    if (state.isLoading) {
      return { success: true, data: state.labs };
    }

    // Cache for 30 seconds unless forced
    const now = Date.now();
    if (!force && state.lastFetch && now - state.lastFetch < 30000 && Object.keys(filters).length === 0) {
      return { success: true, data: state.labs };
    }

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters.institute) params.append("institute", filters.institute);
      if (filters.department) params.append("department", filters.department);

      const response = await api.get(`/labs?${params.toString()}`);
      set({
        labs: response.data.data,
        isLoading: false,
        lastFetch: now,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch labs";
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
      const response = await api.get(`/labs/${labId}/summary`);
      set({
        labSummary: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch lab summary";
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
      const response = await api.post("/labs", data);
      set((state) => ({
        labs: [response.data.data, ...state.labs],
        isLoading: false,
        lastFetch: Date.now(),
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        "Failed to create lab";
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
      const response = await api.put(`/labs/${labId}`, data);
      set((state) => ({
        labs: state.labs.map((lab) =>
          lab.labId === labId ? response.data.data : lab
        ),
        isLoading: false,
        lastFetch: Date.now(),
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        "Failed to update lab";
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
      await api.delete(`/labs/${labId}`);
      set((state) => ({
        labs: state.labs.filter((lab) => lab.labId !== labId),
        isLoading: false,
        lastFetch: Date.now(),
      }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to delete lab";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));