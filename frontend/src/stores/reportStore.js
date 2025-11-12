// =====================================================
// 6. src/stores/reportStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useReportStore = create((set) => ({
  reports: [],
  isLoading: false,

  fetchReports: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get("/reports");
      set({ reports: response.data.data, isLoading: false });
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  generateDailyReport: async (date, generatePDF = false) => {
    try {
      const response = await api.post("/reports/daily", { date, generatePDF });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  generateWeeklyReport: async (weekStart, generatePDF = false) => {
    try {
      const response = await api.post("/reports/weekly", {
        weekStart,
        generatePDF,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  generateMonthlyReport: async (year, month, generatePDF = false) => {
    try {
      const response = await api.post("/reports/monthly", {
        year,
        month,
        generatePDF,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  downloadReport: async (reportId) => {
    try {
      const response = await api.get(`/reports/${reportId}`, {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
}));
