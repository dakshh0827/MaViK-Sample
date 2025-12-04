// =====================================================
// src/stores/authStore.js (UPDATED - Reset all stores on user change)
// =====================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "../lib/axios";

// Import stores to reset
import { useEquipmentStore } from "./equipmentStore";
import { useLabStore } from "./labStore";
import { useInstituteStore } from "./instituteStore";
import { useDashboardStore } from "./dashboardStore";
import { useBreakdownStore } from "./breakdownStore";

// Helper function to reset all data stores
const resetAllDataStores = () => {
  console.log('🔄 Resetting all data stores...');
  
  // Reset equipment store
  useEquipmentStore.setState({
    equipment: [],
    selectedEquipment: null,
    pagination: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    },
    error: null,
  });

  // Reset lab store - FORCE CLEAR CACHE
  useLabStore.setState({
    labs: [],
    labSummary: null,
    error: null,
    lastFetch: null, // Clear cache timestamp
  });

  // Reset institute store - FORCE CLEAR CACHE
  useInstituteStore.setState({
    institutes: [],
    error: null,
    lastFetch: null, // Clear cache timestamp
    pendingRequest: null,
  });

  // Reset dashboard store
  useDashboardStore.setState({
    overview: null,
    realtimeStatus: [],
    sensorData: {},
    labAnalytics: null,
    error: null,
  });

  // Reset breakdown store
  useBreakdownStore.setState({
    breakdownEquipment: [],
    reorderRequests: [],
    error: null,
  });

  console.log('✅ All data stores reset');
};

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      isCheckingAuth: false,

      register: async (userData) => {
        try {
          const response = await api.post("/auth/register", userData);
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      verifyEmail: async (email, otp) => {
        try {
          const response = await api.post("/auth/verify-email", { email, otp });
          const { accessToken, user } = response.data.data;
          
          // RESET ALL STORES before setting new user
          resetAllDataStores();
          
          set({ 
            user, 
            accessToken, 
            isAuthenticated: true,
            isLoading: false 
          });
          
          // Fetch fresh profile data to ensure institute info is loaded
          try {
            const profileResponse = await api.get("/auth/profile");
            set({ user: profileResponse.data.data });
          } catch (profileError) {
            console.error('Failed to fetch full profile:', profileError);
          }
          
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      resendOtp: async (email) => {
        try {
          const response = await api.post("/auth/resend-otp", { email });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      login: async (email, password) => {
        try {
          const response = await api.post("/auth/login", { email, password });
          const { accessToken, user } = response.data.data;
          
          // CRITICAL: Reset all stores before setting new user
          resetAllDataStores();
          
          set({ 
            user, 
            accessToken, 
            isAuthenticated: true,
            isLoading: false
          });
          
          console.log('✅ Login successful, all stores cleared');
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch (error) {
          console.error("Logout failed:", error);
        } finally {
          // Reset all stores on logout
          resetAllDataStores();
          
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isCheckingAuth: false,
            isLoading: false,
          });
          
          console.log('✅ Logout complete, all stores cleared');
        }
      },

      checkAuth: async () => {
        const state = get();
        
        // If already checking auth, don't start another check
        if (state.isCheckingAuth) {
          console.log('⏳ checkAuth already in progress, skipping...');
          return;
        }

        // If we have no token, don't bother checking
        if (!state.accessToken) {
          console.log('🔓 No access token found, setting unauthenticated state');
          resetAllDataStores(); // Clear any stale data
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            isCheckingAuth: false,
          });
          return;
        }

        console.log('🔍 Starting checkAuth...');
        
        set({ 
          isLoading: true,
          isCheckingAuth: true 
        });

        try {
          const response = await api.get("/auth/profile");
          const newUser = response.data.data;
          
          // CRITICAL: Check if user changed and reset stores if so
          const currentUser = state.user;
          if (currentUser && currentUser.id !== newUser.id) {
            console.log('👤 User changed detected, resetting all stores');
            resetAllDataStores();
          }
          
          console.log('✅ checkAuth successful');
          set({
            user: newUser,
            isAuthenticated: true,
            isLoading: false,
            isCheckingAuth: false,
          });
        } catch (error) {
          console.log('❌ checkAuth failed:', error.response?.status);
          
          // Only clear auth on actual auth errors (401, 403)
          if (error.response?.status === 401 || error.response?.status === 403) {
            resetAllDataStores(); // Clear all data on auth failure
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
              isCheckingAuth: false,
            });
          } else {
            // For other errors, just stop loading
            set({
              isLoading: false,
              isCheckingAuth: false,
            });
          }
        }
      },

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      clearAuth: () => {
        console.log('🧹 Clearing auth state');
        resetAllDataStores(); // Clear all data stores
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isCheckingAuth: false,
          isLoading: false,
        });
      },

      updateProfile: async (data) => {
        try {
          const response = await api.put("/auth/profile", data);
          set({ user: response.data.data });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        try {
          const response = await api.put("/auth/change-password", {
            currentPassword,
            newPassword,
          });
          return response.data;
        } catch (error) {
          throw error.response?.data || error;
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);