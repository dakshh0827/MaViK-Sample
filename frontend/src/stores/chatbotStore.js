// =====================================================
// 7. src/stores/chatbotStore.js
// =====================================================

import { create } from "zustand";
import api from "../lib/axios";

export const useChatbotStore = create((set) => ({
  messages: [],
  isLoading: false,

  fetchHistory: async () => {
    try {
      const response = await api.get("/chatbot/history");
      set({ messages: response.data.data });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  sendMessage: async (message) => {
    set({ isLoading: true });
    try {
      const response = await api.post("/chatbot/message", { message });
      set((state) => ({
        messages: [...state.messages, response.data.data],
        isLoading: false,
      }));
      return response.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
