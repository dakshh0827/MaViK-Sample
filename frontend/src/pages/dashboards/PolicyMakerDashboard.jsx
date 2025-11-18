import { useEffect, useState, useMemo } from "react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useAlertStore } from "../../stores/alertStore";
import { useLabStore } from "../../stores/labStore";
import { useEquipmentStore } from "../../stores/equipmentStore";
import { useInstituteStore } from "../../stores/instituteStore";
import StatCard from "../../components/common/StatCard";
import AlertsList from "../../components/dashboard/AlertsList";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import LabManagerForm from "../../components/admin/labManagerForm";
import InstituteManagerForm from "../../components/admin/InstituteManagerForm";
import api from "../../lib/axios";
import { useBreakdownStore } from "../../stores/breakdownStore";
import ReorderRequestsList from "../../components/breakdown/ReorderRequestsList";
import { Package } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart,
} from "recharts";
import {
  Activity,
  Building,
  AlertTriangle,
  TrendingUp,
  Filter,
  Users,
  Box,
  Plus,
  Edit,
  Trash2,
  Building2,
  AlertCircle,
  TrendingDown,
  Clock,
  CheckCircle,
  Zap,
  Gauge,
  ThermometerSun,
  Wind,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
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

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#06B6D4",
];

export default function PolicyMakerDashboard() {
  const {
    overview,
    fetchOverview,
    fetchLabAnalytics,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useDashboardStore();
  const { alerts, fetchAlerts, resolveAlert } = useAlertStore();
  const {
    labs,
    fetchLabs,
    labSummary,
    fetchLabSummary,
    clearLabSummary,
    deleteLab,
    isLoading: labLoading,
  } = useLabStore();

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
  const [selectedLabId, setSelectedLabId] = useState("all");
  const [labManagersCount, setLabManagersCount] = useState(0);
  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [isInstituteModalOpen, setIsInstituteModalOpen] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [labAnalytics, setLabAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log("🚀 Loading Policy Maker Dashboard data...");

        const results = await Promise.allSettled([
          fetchOverview(),
          fetchAlerts({ isResolved: false }),
          fetchInstitutes(),
          fetchLabs(),
        ]);

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            const names = ["Overview", "Alerts", "Institutes", "Labs"];
            console.error(`❌ Failed to load ${names[index]}:`, result.reason);
          }
        });

        fetchFilteredCounts("all", "all", "all");

        console.log("✅ Initial data load complete");
      } catch (error) {
        console.error("❌ Failed to load initial data:", error);
      }
    };
    loadInitialData();
    fetchReorderRequests();
  }, []);

  // Fetch lab analytics when lab is selected
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (selectedLabId !== "all") {
        setAnalyticsLoading(true);
        try {
          const response = await api.get(
            `/monitoring/lab-analytics/${selectedLabId}`
          );
          setLabAnalytics(response.data.data);
        } catch (error) {
          console.error("Failed to fetch lab analytics:", error);
        } finally {
          setAnalyticsLoading(false);
        }
      } else {
        setLabAnalytics(null);
      }
    };
    fetchAnalytics();
  }, [selectedLabId]);

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
    setSelectedLabId("all");
    clearLabSummary();
    fetchFilteredCounts(inst, "all", "all");
  };

  const handleDepartmentChange = (e) => {
    const dept = e.target.value;
    setSelectedDepartment(dept);
    setSelectedLabId("all");
    clearLabSummary();
    fetchFilteredCounts(selectedInstitute, dept, "all");
  };

  const handleLabChange = (e) => {
    const labId = e.target.value;
    setSelectedLabId(labId);
    if (labId !== "all") {
      fetchLabSummary(labId);
    } else {
      clearLabSummary();
    }
    fetchFilteredCounts(selectedInstitute, selectedDepartment, labId);
  };

  const fetchFilteredCounts = async (instituteId, department, labId) => {
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
      if (labId !== "all") eqParams.labId = labId;

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
      if (selectedLabId === labId) {
        setSelectedLabId("all");
        clearLabSummary();
      }
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

  // Prepare analytics data for charts
  const prepareAnalyticsData = () => {
    if (!labAnalytics || !labAnalytics.equipment) return null;

    const equipment = labAnalytics.equipment;

    // Equipment status distribution
    const statusData = equipment.reduce((acc, eq) => {
      const status = eq.status?.status || "OFFLINE";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const statusChartData = Object.entries(statusData).map(
      ([status, count]) => ({
        name: status.replace(/_/g, " "),
        value: count,
      })
    );

    // Health score distribution
    const healthScoreData = equipment.map((eq) => ({
      name: eq.name.substring(0, 20),
      healthScore: eq.status?.healthScore || 0,
      efficiency: eq.analyticsParams?.efficiency || 0,
    }));

    // Performance metrics
    const performanceData = equipment
      .filter((eq) => eq.analyticsParams)
      .map((eq) => ({
        name: eq.name.substring(0, 15),
        efficiency: eq.analyticsParams.efficiency || 0,
        uptime: eq.analyticsParams.totalUptime || 0,
        downtime: eq.analyticsParams.totalDowntime || 0,
        utilization: eq.analyticsParams.utilizationRate || 0,
      }));

    // Department-specific metrics radar chart
    const radarMetrics = [];
    const sampleEquipment = equipment.find((eq) => eq.analyticsParams);

    if (sampleEquipment?.analyticsParams) {
      const params = sampleEquipment.analyticsParams;

      if (params.temperature !== null)
        radarMetrics.push({
          metric: "Temperature",
          value: Math.min((params.temperature / 100) * 100, 100),
        });
      if (params.efficiency !== null)
        radarMetrics.push({ metric: "Efficiency", value: params.efficiency });
      if (params.utilizationRate !== null)
        radarMetrics.push({
          metric: "Utilization",
          value: params.utilizationRate,
        });
      if (params.vibration !== null)
        radarMetrics.push({
          metric: "Vibration",
          value: Math.max(0, 100 - params.vibration * 10),
        });
      if (params.voltage !== null)
        radarMetrics.push({
          metric: "Voltage Stability",
          value: Math.min((params.voltage / 240) * 100, 100),
        });
      if (params.powerFactor !== null)
        radarMetrics.push({
          metric: "Power Factor",
          value: params.powerFactor * 100,
        });
    }

    // Uptime vs Downtime comparison
    const uptimeDowntimeData = equipment
      .filter((eq) => eq.analyticsParams)
      .slice(0, 10)
      .map((eq) => ({
        name: eq.name.substring(0, 12),
        uptime: eq.analyticsParams.totalUptime || 0,
        downtime: eq.analyticsParams.totalDowntime || 0,
      }));

    return {
      statusChartData,
      healthScoreData,
      performanceData,
      radarMetrics,
      uptimeDowntimeData,
    };
  };

  const analyticsData = labAnalytics ? prepareAnalyticsData() : null;

  const isLoading = dashboardLoading || labLoading || institutesLoading;

  if (isLoading && !labs.length && !institutes.length && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (dashboardError && !overview) {
    return (
      <div className="flex items-center justify-center h-96">
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
      title: "Total Institutions",
      value: overview?.overview?.totalInstitutions || 0,
    },
    {
      icon: Activity,
      title: "Total Equipment",
      value: overview?.overview?.totalEquipment || 0,
    },
    {
      icon: AlertTriangle,
      title: "Unresolved Alerts",
      value: overview?.overview?.unresolvedAlerts || 0,
    },
    {
      icon: TrendingUp,
      title: "Avg Health Score",
      value: `${overview?.overview?.avgHealthScore || 0}%`,
    },
  ];

  const filteredStats = [
    {
      icon: Users,
      title: "Lab Managers",
      value: labManagersCount,
    },
    {
      icon: Box,
      title: "Equipment",
      value: pagination.total || 0,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Policy Maker Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Centralized view and management of all institutions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsInstituteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Building2 className="w-5 h-5" />
            Manage Institutes
          </button>
          <button
            onClick={handleOpenCreateLab}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Manage Labs
          </button>
        </div>
      </div>

      {/* Top Section: Overall Stats & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Overall Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {overviewStats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Recent Alerts
          </h2>
          <div className="max-h-64 overflow-y-auto">
            <AlertsList
              alerts={alerts.slice(0, 5)}
              onResolve={handleResolveAlert}
            />
          </div>
        </div>
      </div>

      {/* Filter Analytics & Filtered Statistics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Filter Analytics
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <select
            value={selectedInstitute}
            onChange={handleInstituteChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={institutesLoading}
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={departmentsList.length === 0}
          >
            <option value="all">All Departments</option>
            {departmentsList.map((dept) => (
              <option key={dept} value={dept}>
                {DEPARTMENT_DISPLAY_NAMES[dept] || dept}
              </option>
            ))}
          </select>
          <select
            value={selectedLabId}
            onChange={handleLabChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={labsList.length === 0}
          >
            <option value="all">All Labs</option>
            {labsList.map((lab) => (
              <option key={lab.labId} value={lab.labId}>
                {lab.name} ({lab.labId})
              </option>
            ))}
          </select>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Filtered Results
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {filteredStats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        </div>
      </div>

      {/* Labs List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold mb-4">Labs ({labsList.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          {labsList.length === 0 ? (
            <p className="text-gray-500 text-center py-8 col-span-full">
              No labs match the selected filters.
            </p>
          ) : (
            labsList.map((lab) => (
              <div
                key={lab.labId}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedLabId === lab.labId
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <button
                    onClick={() =>
                      handleLabChange({ target: { value: lab.labId } })
                    }
                    className="font-semibold text-blue-900 hover:underline text-left flex-1"
                  >
                    {lab.name}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditLab(lab)}
                      className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                      title="Edit Lab"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLab(lab.labId)}
                      className="p-1.5 text-gray-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                      title="Delete Lab"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {lab.institute?.name || "N/A"}
                </p>
                <p className="text-sm text-gray-600">
                  {DEPARTMENT_DISPLAY_NAMES[lab.department] || lab.department}
                </p>
                <p className="text-xs text-gray-500 mt-1">{lab.labId}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reorder Requests Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">
                Equipment Reorder Requests
              </h2>
              <p className="text-sm text-gray-600">
                {reorderRequests.filter((r) => r.status === "PENDING").length}{" "}
                pending approval
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPendingOnly(true)}
              className={`px-3 py-1 text-sm rounded ${
                showPendingOnly
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Pending Only
            </button>
            <button
              onClick={() => setShowPendingOnly(false)}
              className={`px-3 py-1 text-sm rounded ${
                !showPendingOnly
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              All Requests
            </button>
          </div>
        </div>
        <div className="p-6">
          <ReorderRequestsList
            requests={
              showPendingOnly
                ? reorderRequests.filter((r) => r.status === "PENDING")
                : reorderRequests
            }
            onReview={async (requestId, action, comments) => {
              await reviewReorderRequest(requestId, action, comments);
              await fetchReorderRequests();
            }}
          />
        </div>
      </div>

      {/* Lab Analytics with Charts */}
      {selectedLabId !== "all" && (
        <>
          {/* Summary Stats */}
          {labSummary && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-6">
              <h2 className="text-xl font-semibold text-blue-900 mb-6">
                Lab Summary: {labSummary.lab?.name || "Lab"}
              </h2>

              {labLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                    <div className="flex items-center justify-between mb-4">
                      <Box className="w-8 h-8 text-blue-600" />
                      <span className="text-3xl font-bold text-gray-900">
                        {labSummary.statistics?.totalEquipment || 0}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Total Equipment
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-green-100">
                    <div className="flex items-center justify-between mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                      <span className="text-3xl font-bold text-green-600">
                        {labSummary.statistics?.avgHealthScore?.toFixed(0) || 0}
                        %
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Avg Health Score
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full transition-all"
                        style={{
                          width: `${
                            labSummary.statistics?.avgHealthScore || 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-emerald-100">
                    <div className="flex items-center justify-between mb-4">
                      <TrendingUp className="w-8 h-8 text-emerald-600" />
                      <span className="text-3xl font-bold text-gray-900">
                        {labSummary.statistics?.totalUptime?.toFixed(1) || 0}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Total Uptime (hrs)
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            ((labSummary.statistics?.totalUptime || 0) /
                              (labSummary.statistics?.totalUptime +
                                labSummary.statistics?.totalDowntime || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-red-100">
                    <div className="flex items-center justify-between mb-4">
                      <TrendingDown className="w-8 h-8 text-red-600" />
                      <span className="text-3xl font-bold text-red-600">
                        {labSummary.statistics?.totalDowntime?.toFixed(1) || 0}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      Total Downtime (hrs)
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            ((labSummary.statistics?.totalDowntime || 0) /
                              (labSummary.statistics?.totalUptime +
                                labSummary.statistics?.totalDowntime || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-purple-100">
                    <div className="flex items-center justify-between mb-4">
                      <Clock className="w-8 h-8 text-purple-600" />
                      <span className="text-3xl font-bold text-gray-900">
                        {labSummary.statistics?.inClassEquipment || 0}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      In-Class Equipment
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-600 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            ((labSummary.statistics?.inClassEquipment || 0) /
                              (labSummary.statistics?.totalEquipment || 1)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Analytics Charts */}
          {analyticsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Equipment Status & Health Score */}
              <div className="grid grid-cols-4 lg:grid-cols-4 gap-6">
                {/* Equipment Status Distribution */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 col-span-1">
                  <div className="flex items-center gap-2 mb-4">
                    <PieChartIcon className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Equipment Status Distribution
                    </h3>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.statusChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {analyticsData.statusChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Health Score Comparison */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 col-span-3">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Health Score & Efficiency
                    </h3>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.healthScoreData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="healthScore"
                        fill="#10B981"
                        name="Health Score"
                      />
                      <Bar
                        dataKey="efficiency"
                        fill="#3B82F6"
                        name="Efficiency %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Performance Metrics */}
              {/* <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Gauge className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Equipment Performance Metrics</h3>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={analyticsData.performanceData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="efficiency" fill="#8B5CF6" name="Efficiency %" />
                    <Bar dataKey="utilization" fill="#F59E0B" name="Utilization %" />
                  </BarChart>
                </ResponsiveContainer>
              </div> */}

              {/* Uptime vs Downtime */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <LineChartIcon className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Uptime vs Downtime Analysis
                    </h3>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={analyticsData.uptimeDowntimeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                      />
                      <YAxis
                        label={{
                          value: "Hours",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="uptime"
                        stackId="1"
                        stroke="#10B981"
                        fill="#10B981"
                        name="Uptime (hrs)"
                      />
                      <Area
                        type="monotone"
                        dataKey="downtime"
                        stackId="1"
                        stroke="#EF4444"
                        fill="#EF4444"
                        name="Downtime (hrs)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Radar Chart for Department Metrics */}
                {analyticsData.radarMetrics.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Department-Specific Performance Radar
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={400}>
                      <RadarChart data={analyticsData.radarMetrics}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <Radar
                          name="Performance"
                          dataKey="value"
                          stroke="#8B5CF6"
                          fill="#8B5CF6"
                          fillOpacity={0.6}
                        />
                        <Tooltip />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Detailed Equipment Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Equipment Details
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Equipment
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Health Score
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Efficiency
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Temperature
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Uptime
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Utilization
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {labAnalytics.equipment.map((eq) => (
                        <tr key={eq.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {eq.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                eq.status?.status === "OPERATIONAL"
                                  ? "bg-green-100 text-green-800"
                                  : eq.status?.status === "IN_USE"
                                  ? "bg-blue-100 text-blue-800"
                                  : eq.status?.status === "MAINTENANCE"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : eq.status?.status === "FAULTY"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {eq.status?.status || "OFFLINE"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <span className="mr-2">
                                {eq.status?.healthScore?.toFixed(0) || 0}%
                              </span>
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    (eq.status?.healthScore || 0) >= 80
                                      ? "bg-green-500"
                                      : (eq.status?.healthScore || 0) >= 50
                                      ? "bg-yellow-500"
                                      : "bg-red-500"
                                  }`}
                                  style={{
                                    width: `${eq.status?.healthScore || 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {eq.analyticsParams?.efficiency?.toFixed(1) ||
                              "N/A"}
                            %
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {eq.analyticsParams?.temperature?.toFixed(1) ||
                              "N/A"}
                            °C
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {eq.analyticsParams?.totalUptime?.toFixed(1) ||
                              "N/A"}
                            h
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {eq.analyticsParams?.utilizationRate?.toFixed(1) ||
                              "N/A"}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* Modals */}
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
