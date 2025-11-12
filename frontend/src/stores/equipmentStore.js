// =====================================================
// 3. src/stores/equipmentStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useEquipmentStore = create((set) => ({
  equipment: [],
  selectedEquipment: null,
  stats: null,
  isLoading: false,
  error: null,

  fetchEquipment: async (filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/equipment", { params: filters });
      set({ equipment: response.data.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      throw error;
    }
  },

  fetchEquipmentById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/equipment/${id}`);
      set({ selectedEquipment: response.data.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    try {
      const response = await api.get("/equipment/stats");
      set({ stats: response.data.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createEquipment: async (data) => {
    try {
      const response = await api.post("/equipment", data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  updateEquipment: async (id, data) => {
    try {
      const response = await api.put(`/equipment/${id}`, data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  deleteEquipment: async (id) => {
    try {
      const response = await api.delete(`/equipment/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
}));
