/*
 * =====================================================
 * frontend/src/stores/breakdownStore.js
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useBreakdownStore = create((set) => ({
  breakdownEquipment: [],
  reorderRequests: [],
  isLoading: false,
  error: null,

  // Fetch breakdown equipment
  fetchBreakdownEquipment: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/breakdown");
      set({
        breakdownEquipment: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.data?.message ||
          "Failed to fetch breakdown equipment",
        isLoading: false,
      });
      throw error;
    }
  },

  // Respond to breakdown alert
  respondToBreakdownAlert: async (alertId, isBreakdown, reason = null) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/breakdown/alert/${alertId}/respond`, {
        isBreakdown,
        reason,
      });
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error: error.response?.data?.message || "Failed to respond to alert",
        isLoading: false,
      });
      throw error;
    }
  },

  // Manually add equipment to breakdown list
  addBreakdownEquipment: async (equipmentId, reason) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/breakdown/add", {
        equipmentId,
        reason,
      });
      set((state) => ({
        breakdownEquipment: [response.data.data, ...state.breakdownEquipment],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.data?.message || "Failed to add breakdown equipment",
        isLoading: false,
      });
      throw error;
    }
  },

  // Submit reorder request
  submitReorderRequest: async (breakdownId, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        `/breakdown/${breakdownId}/reorder`,
        data
      );
      set({ isLoading: false });
      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.data?.message || "Failed to submit reorder request",
        isLoading: false,
      });
      throw error;
    }
  },

  // Fetch reorder requests (for Policy Maker)
  fetchReorderRequests: async (status = null) => {
    set({ isLoading: true, error: null });
    try {
      const params = status ? { status } : {};
      const response = await api.get("/breakdown/reorders", { params });
      set({
        reorderRequests: response.data.data,
        isLoading: false,
      });
      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.data?.message || "Failed to fetch reorder requests",
        isLoading: false,
      });
      throw error;
    }
  },

  // Review reorder request
  reviewReorderRequest: async (requestId, action, comments = null) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        `/breakdown/reorders/${requestId}/review`,
        {
          action, // 'APPROVED' or 'REJECTED'
          comments,
        }
      );

      // Update local state
      set((state) => ({
        reorderRequests: state.reorderRequests.map((req) =>
          req.id === requestId ? response.data.data : req
        ),
        isLoading: false,
      }));

      return response.data;
    } catch (error) {
      set({
        error:
          error.response?.data?.message || "Failed to review reorder request",
        isLoading: false,
      });
      throw error;
    }
  },

  // Resolve breakdown
  resolveBreakdown: async (breakdownId) => {
    set({ isLoading: true, error: null });
    try {
      await api.patch(`/breakdown/${breakdownId}/resolve`);

      // Update local state
      set((state) => ({
        breakdownEquipment: state.breakdownEquipment.map((bd) =>
          bd.id === breakdownId ? { ...bd, status: "RESOLVED" } : bd
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error.response?.data?.message || "Failed to resolve breakdown",
        isLoading: false,
      });
      throw error;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
