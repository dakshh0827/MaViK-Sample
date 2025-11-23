import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useAlertStore } from "../../stores/alertStore";
import { useLabStore } from "../../stores/labStore";
import { useEquipmentStore } from "../../stores/equipmentStore";
import { useInstituteStore } from "../../stores/instituteStore";
import { useBreakdownStore } from "../../stores/breakdownStore";
import AlertsList from "../../components/dashboard/AlertsList";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import LabManagerForm from "../../components/admin/labManagerForm";
import InstituteManagerForm from "../../components/admin/InstituteManagerForm";
import api from "../../lib/axios";
import {
  Activity,
  Building,
  AlertTriangle,
  TrendingUp,
  Filter,
  Users,
  Box,
  Edit,
  Trash2,
  AlertCircle,
  Package,
  ExternalLink,
  LayoutGrid,
  List,
  ArrowRight,
  X,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  MapPin,
  FileText,
  ChevronRight,
  Search,
} from "lucide-react";

const DEPARTMENT_DISPLAY_NAMES = {
  FITTER_MANUFACTURING: "Fitter/Manufacturing",
  ELECTRICAL_ENGINEERING: "Electrical Engineering",
  WELDING_FABRICATION: "Welding & Fabrication",
  TOOL_DIE_MAKING: "Tool & Die Making",
  ADDITIVE_MANUFACTURING: "Additive Manufacturing",
  SOLAR_INSTALLER_PV: "Solar Installer (PV)",
  MATERIAL_TESTING_QUALITY: "Material Testing/Quality",
  ADVANCED_MANUFACTURING_CNC: "Advanced Manufacturing/CNC",
  AUTOMOTIVE_MECHANIC: "Automotive/Mechanic",
};

// Helper function for text truncation
const truncateText = (text, maxLength = 24) => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};

export default function PolicyMakerDashboard() {
  const navigate = useNavigate();
  const {
    overview,
    fetchOverview,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useDashboardStore();
  const { alerts, fetchAlerts, resolveAlert } = useAlertStore();
  const { labs, fetchLabs, deleteLab, isLoading: labLoading } = useLabStore();

  const { reorderRequests, fetchReorderRequests, reviewReorderRequest } =
    useBreakdownStore();

  const [showPendingOnly, setShowPendingOnly] = useState(true);
  const { pagination, fetchEquipment } = useEquipmentStore();
  const {
    institutes,
    fetchInstitutes,
    isLoading: institutesLoading,
  } = useInstituteStore();

  const [selectedInstitute, setSelectedInstitute] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [labManagersCount, setLabManagersCount] = useState(0);
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isInstituteModalOpen, setIsInstituteModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);

  // CHANGE 1: Set default view mode to "list"
  const [viewMode, setViewMode] = useState("list");

  // State for the merged Review Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log("🚀 Loading Policy Maker Dashboard data...");

        const results = await Promise.allSettled([
          fetchOverview(),
          fetchAlerts({ isResolved: false }),
          fetchInstitutes(),
          fetchLabs(),
          fetchReorderRequests(),
        ]);

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            const names = [
              "Overview",
              "Alerts",
              "Institutes",
              "Labs",
              "Reorder Requests",
            ];
            console.error(`❌ Failed to load ${names[index]}:`, result.reason);
          }
        });

        fetchFilteredCounts("all", "all");

        console.log("✅ Initial data load complete");
      } catch (error) {
        console.error("❌ Failed to load initial data:", error);
      }
    };
    loadInitialData();
  }, []);

  const institutesList = institutes;

  const departmentsList = useMemo(() => {
    if (selectedInstitute === "all") {
      return [...new Set(labs.map((lab) => lab.department))].sort();
    }
    return [
      ...new Set(
        labs
          .filter((lab) => lab.instituteId === selectedInstitute)
          .map((lab) => lab.department)
      ),
    ].sort();
  }, [labs, selectedInstitute]);

  const labsList = useMemo(() => {
    return labs.filter((lab) => {
      const instituteMatch =
        selectedInstitute === "all" || lab.instituteId === selectedInstitute;
      const departmentMatch =
        selectedDepartment === "all" || lab.department === selectedDepartment;
      return instituteMatch && departmentMatch;
    });
  }, [labs, selectedInstitute, selectedDepartment]);

  const handleInstituteChange = (e) => {
    const inst = e.target.value;
    setSelectedInstitute(inst);
    setSelectedDepartment("all");
    fetchFilteredCounts(inst, "all");
  };

  const handleDepartmentChange = (e) => {
    const dept = e.target.value;
    setSelectedDepartment(dept);
    fetchFilteredCounts(selectedInstitute, dept);
  };

  const fetchFilteredCounts = async (instituteId, department) => {
    try {
      const userParams = new URLSearchParams();
      userParams.append("role", "LAB_MANAGER");
      if (instituteId !== "all") userParams.append("instituteId", instituteId);

      const userRes = await api.get("/users", { params: userParams });

      let managers = userRes.data.data || [];
      if (department !== "all") {
        managers = managers.filter((user) => user.department === department);
      }
      setLabManagersCount(managers.length);

      const eqParams = {};
      if (instituteId !== "all") eqParams.instituteId = instituteId;
      if (department !== "all") eqParams.department = department;

      await fetchEquipment(eqParams);
    } catch (error) {
      console.error("Failed to fetch filtered counts:", error);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await resolveAlert(alertId);
      await Promise.all([fetchAlerts({ isResolved: false }), fetchOverview()]);
    } catch (error) {
      console.error("Failed to resolve alert:", error);
      alert("Failed to resolve alert. Please try again.");
    }
  };

  const handleReviewAction = async (action) => {
    if (!selectedRequest) return;
    setIsSubmittingReview(true);
    try {
      await reviewReorderRequest(selectedRequest.id, action, reviewComment);
      await fetchReorderRequests();
      setSelectedRequest(null);
      setReviewComment("");
    } catch (error) {
      console.error("Failed to review request:", error);
      alert("Failed to process review. Please try again.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const openRequestModal = (request) => {
    setReviewComment("");
    setSelectedRequest(request);
  };

  const handleOpenCreateLab = () => {
    setEditingLab(null);
    setIsLabModalOpen(true);
  };

  const handleOpenEditLab = (lab) => {
    setEditingLab(lab);
    setIsLabModalOpen(true);
  };

  const handleDeleteLab = async (labId) => {
    if (
      !window.confirm(
        `Are you sure you want to delete lab ${labId}? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteLab(labId);
      await fetchLabs();
    } catch (error) {
      alert(error.message || "Failed to delete lab");
    }
  };

  const handleLabModalClose = async () => {
    setIsLabModalOpen(false);
    setEditingLab(null);
    await fetchLabs();
  };

  const handleInstituteModalClose = async () => {
    setIsInstituteModalOpen(false);
    await fetchInstitutes();
    await fetchLabs();
  };

  const handleLabClick = (labId) => {
    navigate(`/dashboard/lab-analytics/${labId}`);
  };

  const isLoading = dashboardLoading || labLoading || institutesLoading;

  if (isLoading && !labs.length && !institutes.length && !overview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (dashboardError && !overview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load Dashboard
          </h2>
          <p className="text-gray-600 mb-4">{dashboardError}</p>
          <button
            onClick={() => fetchOverview()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const overviewStats = [
    {
      icon: Building,
      title: "Institutions",
      value: overview?.overview?.totalInstitutions || 0,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      icon: Activity,
      title: "Total Equipment",
      value: overview?.overview?.totalEquipment || 0,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Users,
      title: "Lab Managers",
      value: labManagersCount,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: Box,
      title: "Items in Stock",
      value: pagination.total || 0,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      icon: AlertTriangle,
      title: "Active Alerts",
      value: overview?.overview?.unresolvedAlerts || 0,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      icon: TrendingUp,
      title: "Health Score",
      value: `${overview?.overview?.avgHealthScore || 0}%`,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
  ];

  const pendingReorders = reorderRequests.filter((r) => r.status === "PENDING");
  const displayedReorders = showPendingOnly ? pendingReorders : reorderRequests;

  return (
    <div className="h-[calc(94vh-4rem)] mt-0.5 overflow-hidden bg-gray-50 p-1">
      {/* Main Dashboard Grid */}
      <div className="h-full grid grid-cols-12 gap-4">
        {/* LEFT SECTION - 8 Columns */}
        <div className="col-span-8 flex flex-col gap-4 h-full min-h-0">
          {/* 1. Statistics Section (Grid of cards) */}
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            {overviewStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900 leading-tight">
                      {stat.value}
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                      {stat.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Labs Directory (Wide Left) */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
            {/* Toolbar Row */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-white flex-shrink-0 gap-4">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Building className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-800">
                  Labs Directory
                </h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-medium">
                  {labsList.length}
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-1 justify-end">
                <div className="flex items-center gap-2 max-w-2xl flex-1 justify-end">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={selectedInstitute}
                    onChange={handleInstituteChange}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 max-w-[200px]"
                  >
                    <option value="all">All Institutes</option>
                    {institutesList.map((inst) => (
                      <option key={inst.id} value={inst.instituteId}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedDepartment}
                    onChange={handleDepartmentChange}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50 max-w-[200px]"
                    disabled={departmentsList.length === 0}
                  >
                    <option value="all">All Departments</option>
                    {departmentsList.map((dept) => (
                      <option key={dept} value={dept}>
                        {DEPARTMENT_DISPLAY_NAMES[dept] || dept}
                      </option>
                    ))}
                  </select>
                </div>

                {/* View Toggles */}
                <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
                  <button
                    onClick={() => setViewMode("cards")}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === "cards"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded transition-all ${
                      viewMode === "list"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Labs List Content */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-gray-50/30">
              {labsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Building className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">No labs match the selected filters.</p>
                </div>
              ) : viewMode === "cards" ? (
                // Grid View - 3 Columns
                <div className="grid grid-cols-3 gap-4">
                  {labsList.map((lab) => (
                    <div
                      key={lab.labId}
                      className="group relative flex flex-col p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all h-full"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Building className="w-5 h-5" />
                        </div>
                        {/* Quick Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenEditLab(lab)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLab(lab.labId)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => handleLabClick(lab.labId)}
                        className="text-left flex-1"
                      >
                        <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-blue-700">
                          {lab.name}
                        </h4>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3" />{" "}
                            {lab.institute?.name || "N/A"}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                            <Box className="w-3 h-3" />{" "}
                            {DEPARTMENT_DISPLAY_NAMES[lab.department] ||
                              lab.department}
                          </p>
                        </div>
                      </button>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-400">
                          #{lab.labId.slice(0, 8)}
                        </span>
                        <span className="text-blue-600 font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Details <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // List View
                <div className="space-y-2">
                  {labsList.map((lab) => (
                    <div
                      key={lab.labId}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-400 hover:shadow-sm transition-all group"
                    >
                      <button
                        onClick={() => handleLabClick(lab.labId)}
                        className="flex items-center gap-4 flex-1 text-left"
                      >
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Building className="w-4 h-4" />
                        </div>
                        <div className="grid grid-cols-12 gap-4 flex-1 items-center">
                          <div className="col-span-4">
                            <div className="font-semibold text-gray-900 text-sm group-hover:text-blue-700">
                              {lab.name}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                              {lab.labId}
                            </div>
                          </div>
                          <div className="col-span-4 text-xs text-gray-600 truncate">
                            {lab.institute?.name || "N/A"}
                          </div>
                          <div className="col-span-4 text-xs text-gray-600 truncate">
                            {DEPARTMENT_DISPLAY_NAMES[lab.department] ||
                              lab.department}
                          </div>
                        </div>
                      </button>

                      <div className="flex gap-2 pl-4 border-l border-gray-100">
                        <button
                          onClick={() => handleOpenEditLab(lab)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLab(lab.labId)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleLabClick(lab.labId)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT SECTION - 4 Columns */}
        <div className="col-span-4 flex flex-col gap-4 h-full min-h-0">
          {/* 1. Alerts Section (Increased height to 45% - approx half) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[45%]">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  {alerts.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-gray-800">
                  Recent Alerts
                </h3>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {alerts.length} Active
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-0 min-h-0">
              <AlertsList
                alerts={alerts}
                onResolve={handleResolveAlert}
                compact={true}
              />
            </div>
          </div>

          {/* 2. Reorder Requests (Flex-1 takes remaining space) */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-2 flex-shrink-0 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-800">
                    Reorder Requests
                  </h3>
                </div>
                <button
                  onClick={() => navigate("/reorder-requests")}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="View Full Page"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex bg-gray-100 p-1 rounded-lg w-full">
                <button
                  onClick={() => setShowPendingOnly(true)}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all text-center ${
                    showPendingOnly
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Pending ({pendingReorders.length})
                </button>
                <button
                  onClick={() => setShowPendingOnly(false)}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-all text-center ${
                    !showPendingOnly
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 min-h-0 bg-gray-50/50">
              {displayedReorders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-4">
                  <Package className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs">No requests found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedReorders.map((request) => (
                    <div
                      key={request.id}
                      onClick={() => openRequestModal(request)}
                      className="group bg-white p-2.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer flex items-start gap-3"
                    >
                      <div
                        className={`w-1.5 h-1.5 mt-1.5 rounded-full flex-shrink-0 ${
                          request.priority === "CRITICAL"
                            ? "bg-red-500 shadow-red-200 shadow-sm"
                            : request.priority === "HIGH"
                            ? "bg-orange-400"
                            : "bg-yellow-400"
                        }`}
                        title={`Priority: ${request.priority}`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-medium text-xs text-gray-900 truncate max-w-[70%]">
                            {request.equipmentName}
                          </h4>
                          <span className="text-[10px] text-gray-400">
                            {new Date(request.createdAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 truncate mb-1">
                          {request.labName}
                        </div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              request.status === "PENDING"
                                ? "bg-blue-50 text-blue-600"
                                : request.status === "APPROVED"
                                ? "bg-green-50 text-green-600"
                                : "bg-gray-50 text-gray-500"
                            }`}
                          >
                            {request.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MERGED DETAILS & REVIEW MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Request Details
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    ID: {selectedRequest.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status and Priority Banner */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Status
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`px-3 py-1 text-sm font-bold rounded-full ${
                        selectedRequest.status === "PENDING"
                          ? "bg-blue-100 text-blue-700"
                          : selectedRequest.status === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Priority
                  </span>
                  <div className="mt-1">
                    <span
                      className={`px-3 py-1 text-sm font-bold rounded-full inline-flex items-center gap-1 ${
                        selectedRequest.priority === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : selectedRequest.priority === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {selectedRequest.priority}
                    </span>
                  </div>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Requested Date
                  </span>
                  <div className="mt-1 flex items-center gap-2 text-sm text-gray-900 font-medium">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(selectedRequest.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Grid Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
                      <Box className="w-4 h-4" /> Equipment
                    </h4>
                    <p className="text-base font-semibold text-gray-900">
                      {selectedRequest.equipmentName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Type: {selectedRequest.type || "Consumable"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Quantity Info
                    </h4>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Current:</span>{" "}
                        <span className="font-mono font-medium text-gray-900">
                          {selectedRequest.currentStock || 0}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-300"></div>
                      <div>
                        <span className="text-gray-500">Requested:</span>{" "}
                        <span className="font-mono font-bold text-blue-600">
                          {selectedRequest.quantity || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location
                    </h4>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedRequest.labName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedRequest.instituteName || "Main Institute"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2">
                      <User className="w-4 h-4" /> Requested By
                    </h4>
                    <p className="text-sm text-gray-900">
                      {selectedRequest.requestedBy || "Lab Manager"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedRequest.requesterRole || "Staff"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Reason / Description
                </h4>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm text-gray-700 leading-relaxed">
                  {selectedRequest.description ||
                    "No additional description provided."}
                </div>
              </div>

              {/* Review Section (Conditional) */}
              {selectedRequest.status === "PENDING" && (
                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">
                    Review Actions
                  </h4>
                  <div className="space-y-4">
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Enter approval notes or rejection reason (required for rejection)..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm min-h-[100px] resize-y transition-all"
                    />

                    <div className="flex gap-4">
                      <button
                        onClick={() => handleReviewAction("APPROVED")}
                        disabled={isSubmittingReview}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm hover:shadow"
                      >
                        {isSubmittingReview ? (
                          <LoadingSpinner size="sm" color="white" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" /> Approve Request
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleReviewAction("REJECTED")}
                        disabled={isSubmittingReview || !reviewComment.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                        title={
                          !reviewComment.trim()
                            ? "Please add a comment to reject"
                            : ""
                        }
                      >
                        {isSubmittingReview ? (
                          <LoadingSpinner size="sm" color="red" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" /> Reject Request
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Other Modals */}
      {isLabModalOpen && (
        <LabManagerForm
          isOpen={isLabModalOpen}
          onClose={handleLabModalClose}
          labToEdit={editingLab}
        />
      )}

      {isInstituteModalOpen && (
        <InstituteManagerForm
          isOpen={isInstituteModalOpen}
          onClose={handleInstituteModalClose}
        />
      )}
    </div>
  );
}
