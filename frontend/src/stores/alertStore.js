/*
 * =====================================================
 * frontend/src/stores/alertStore.js (FIXED)
 * =====================================================
 */
import { create } from "zustand";
import api from "../lib/axios";

export const useAlertStore = create((set) => ({
  alerts: [],
  unreadCount: 0,
  isLoading: false,
  
  fetchAlerts: async (filters = {}) => {
    console.log('🔔 [AlertStore] fetchAlerts called with filters:', filters);
    set({ isLoading: true });
    try {
      const response = await api.get("/alerts", { params: filters });
      console.log('📦 [AlertStore] API Response:', response.data);
      
      const alertsData = response.data.data || response.data || [];
      console.log('✅ [AlertStore] Setting alerts to:', alertsData);
      
      set({ 
        alerts: alertsData, 
        isLoading: false 
      });
      
      // Return the response data
      return response.data;
    } catch (error) {
      console.error('❌ [AlertStore] Error fetching alerts:', error);
      set({ isLoading: false, alerts: [] });
      throw error;
    }
  },
  
  resolveAlert: async (id) => {
    try {
      console.log('🔄 Resolving alert:', id);
      // FIXED: Changed backtick to parenthesis
      const response = await api.put(`/alerts/${id}/resolve`);
      console.log('✅ Alert resolved:', id);
      
      set((state) => ({
        alerts: state.alerts.map((alert) =>
          alert.id === id ? { ...alert, isResolved: true } : alert
        ),
      }));
      
      return response.data;
    } catch (error) {
      console.error('❌ Error resolving alert:', error);
      throw error;
    }
  },
  
  // NEW: Check if alert is a breakdown alert
  isBreakdownAlert: (alert) => {
    return alert.type === "EQUIPMENT_BREAKDOWN_CHECK";
  },
  
  // NEW: Clear all alerts
  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
  
  // NEW: Reset store
  reset: () => set({ 
    alerts: [], 
    unreadCount: 0, 
    isLoading: false 
  }),
}));