// =====================================================
// 2. src/stores/authStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem("token"),
  isAuthenticated: false,
  isLoading: true,

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
      const { token, user } = response.data.data;
      localStorage.setItem("token", token);
      set({ user, token, isAuthenticated: true });
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
      const { token, user } = response.data.data;
      localStorage.setItem("token", token);
      set({ user, token, isAuthenticated: true });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const response = await api.get("/auth/profile");
      set({
        user: response.data.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem("token");
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
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
}));
