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

  // Fetch reorder requests (for Policy Maker) - FIXED WITH DATA TRANSFORMATION
  fetchReorderRequests: async (status = null) => {
    set({ isLoading: true, error: null });
    try {
      const params = status ? { status } : {};
      const response = await api.get("/breakdown/reorders", { params });

      console.log("📦 Raw reorder requests from backend:", response.data);

      // Transform backend data to match frontend expectations
      const transformedData = (response.data.data || []).map((request) => {
        const equipment = request.breakdown?.equipment;
        const lab = equipment?.lab;
        const institute = lab?.institute;
        const requester = request.requestedByUser;

        return {
          // Keep original fields
          ...request,

          // Add/transform fields expected by frontend
          equipmentName:
            equipment?.name || request.equipmentName || "Unknown Equipment",
          labName: lab?.name || "Unknown Lab",
          instituteName: institute?.name || "Unknown Institute",

          // Requester info
          requestedBy: requester
            ? `${requester.firstName} ${requester.lastName}`.trim()
            : "Unknown User",
          requesterRole: "Lab Manager",
          requesterDepartment: requester?.department || "",
          requesterInstitute: requester?.instituteId || "",

          // Map urgency to priority (if needed)
          priority: request.urgency || "MEDIUM",

          // Description/reason
          description: request.reason || "No reason provided",

          // Review info
          reviewComments: request.reviewComments || "",
          reviewedBy: request.reviewedByUser
            ? `${request.reviewedByUser.firstName} ${request.reviewedByUser.lastName}`.trim()
            : null,

          // Dates
          createdAt: request.requestedAt || request.createdAt,

          // Additional useful fields
          currentStock: equipment?.quantity || 0,
          type: equipment?.type || "Unknown",
        };
      });

      console.log("✅ Transformed reorder requests:", transformedData);

      set({
        reorderRequests: transformedData,
        isLoading: false,
      });

      return { ...response.data, data: transformedData };
    } catch (error) {
      console.error("❌ Failed to fetch reorder requests:", error);
      console.error("Error response:", error.response?.data);
      set({
        error:
          error.response?.data?.message || "Failed to fetch reorder requests",
        reorderRequests: [], // Set empty array on error
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

      console.log("✅ Review response:", response.data);

      // Transform the updated request
      const updatedRequest = response.data.data;
      const equipment = updatedRequest.breakdown?.equipment;
      const lab = equipment?.lab;
      const institute = lab?.institute;
      const requester = updatedRequest.requestedByUser;

      const transformed = {
        ...updatedRequest,
        equipmentName:
          equipment?.name ||
          updatedRequest.equipmentName ||
          "Unknown Equipment",
        labName: lab?.name || "Unknown Lab",
        instituteName: institute?.name || "Unknown Institute",
        requestedBy: requester
          ? `${requester.firstName} ${requester.lastName}`.trim()
          : "Unknown User",
        requesterRole: "Lab Manager",
        priority: updatedRequest.urgency || "MEDIUM",
        description: updatedRequest.reason || "No reason provided",
        reviewComments: updatedRequest.reviewComments || "",
        reviewedBy: updatedRequest.reviewedByUser
          ? `${updatedRequest.reviewedByUser.firstName} ${updatedRequest.reviewedByUser.lastName}`.trim()
          : null,
        createdAt: updatedRequest.requestedAt || updatedRequest.createdAt,
        currentStock: equipment?.quantity || 0,
        type: equipment?.type || "Unknown",
      };

      // Update local state
      set((state) => ({
        reorderRequests: state.reorderRequests.map((req) =>
          req.id === requestId ? transformed : req
        ),
        isLoading: false,
      }));

      return { ...response.data, data: transformed };
    } catch (error) {
      console.error("❌ Failed to review reorder request:", error);
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
