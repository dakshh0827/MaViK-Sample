// =====================================================
// 4. src/stores/dashboardStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useDashboardStore = create((set) => ({
  overview: null,
  realtimeStatus: [],
  sensorData: {},
  isLoading: false,

  fetchOverview: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get("/monitoring/dashboard");
      set({ overview: response.data.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchRealtimeStatus: async () => {
    try {
      const response = await api.get("/monitoring/realtime");
      set({ realtimeStatus: response.data.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  fetchSensorData: async (equipmentId, hours = 24) => {
    try {
      const response = await api.get(`/monitoring/sensor/${equipmentId}`, {
        params: { hours },
      });
      set((state) => ({
        sensorData: {
          ...state.sensorData,
          [equipmentId]: response.data.data,
        },
      }));
      return response.data;
    } catch (error) {
      throw error;
    }
  },
}));
