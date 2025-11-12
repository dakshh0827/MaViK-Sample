// =====================================================
// 5. src/stores/alertStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useAlertStore = create((set) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,

  fetchAlerts: async (filters = {}) => {
    set({ isLoading: true });
    try {
      const response = await api.get("/alerts", { params: filters });
      set({ alerts: response.data.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  resolveAlert: async (id) => {
    try {
      const response = await api.put(`/alerts/${id}/resolve`);
      set((state) => ({
        alerts: state.alerts.map((alert) =>
          alert.id === id ? { ...alert, isResolved: true } : alert
        ),
      }));
      return response.data;
    } catch (error) {
      throw error;
    }
  },
}));
