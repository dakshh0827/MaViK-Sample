/*
 * =====================================================
 * frontend/src/stores/instituteStore.js (FIXED)
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useInstituteStore = create((set, get) => ({
  institutes: [],
  isLoading: false,
  error: null,
  lastFetch: null, // Track last fetch time

  // Fetch all institutes
  fetchInstitutes: async (force = false) => {
    const state = get();
    
    // Prevent multiple simultaneous calls
    if (state.isLoading) {
      return { success: true, data: state.institutes };
    }

    // Cache for 30 seconds unless forced
    const now = Date.now();
    if (!force && state.lastFetch && now - state.lastFetch < 30000) {
      return { success: true, data: state.institutes };
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/institutes");
      set({
        institutes: response.data.data,
        isLoading: false,
        lastFetch: now,
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to fetch institutes";
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
      const response = await api.post("/institutes", data);
      set((state) => ({
        institutes: [...state.institutes, response.data.data].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
        isLoading: false,
        lastFetch: Date.now(),
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to create institute";
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
      const response = await api.put(`/institutes/${instituteId}`, { name });
      set((state) => ({
        institutes: state.institutes
          .map((inst) => (inst.instituteId === instituteId ? response.data.data : inst))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false,
        lastFetch: Date.now(),
      }));
      return response.data;
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to update institute";
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
      await api.delete(`/institutes/${instituteId}`);
      set((state) => ({
        institutes: state.institutes.filter((inst) => inst.instituteId !== instituteId),
        isLoading: false,
        lastFetch: Date.now(),
      }));
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Failed to delete institute";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));