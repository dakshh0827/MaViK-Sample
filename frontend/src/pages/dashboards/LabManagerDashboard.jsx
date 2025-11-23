/*
 * =====================================================
 * LabManagerDashboard.jsx - FIXED VERSION
 * =====================================================
 * Changes:
 * 1. Removed "Lab Analytics" section from dashboard
 * 2. Only "My Labs" section remains with clickable lab names
 * 3. Cleaned up unused labSummary state management
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useEquipmentStore } from "../../stores/equipmentStore";
import { useAlertStore } from "../../stores/alertStore";
import { useAuthStore } from "../../stores/authStore";
import { useLabStore } from "../../stores/labStore";
import StatCard from "../../components/common/StatCard";
import EquipmentTable from "../../components/dashboard/EquipmentTable";
import AlertsList from "../../components/dashboard/AlertsList";
import AlertHistoryTable from "../../components/dashboard/AlertHistoryTable";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EquipmentFormModal from "../../components/equipment/EquipmentFormModal";
import { useBreakdownStore } from "../../stores/breakdownStore";
import BreakdownEquipmentTable from "../../components/breakdown/BreakdownEquipmentTable";
import AddBreakdownModal from "../../components/breakdown/AddBreakdownModal";
import BreakdownAlertModal from "../../components/breakdown/BreakdownAlertModal";
import {
  Activity,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Building,
  Plus,
  Filter,
  Download,
  List,
  History,
  ExternalLink,
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

// Helper function to safely get institute name
const getInstituteName = (institute) => {
  if (!institute) return "Loading...";
  if (typeof institute === "string") return institute;
  if (typeof institute === "object") {
    return institute.name || institute.instituteId || "Unknown Institute";
  }
  return "Unknown Institute";
};

export default function LabManagerDashboard() {
  const navigate = useNavigate();
  const { user, checkAuth } = useAuthStore();
  const {
    overview,
    fetchOverview,
    isLoading: dashboardLoading,
  } = useDashboardStore();
  const {
    equipment,
    fetchEquipment,
    createEquipment,
    updateEquipment,
    deleteEquipment,
    isLoading: equipmentLoading,
  } = useEquipmentStore();

  const { fetchAlerts, resolveAlert } = useAlertStore();

  const { labs, fetchLabs, isLoading: labLoading } = useLabStore();

  const {
    breakdownEquipment,
    fetchBreakdownEquipment,
    respondToBreakdownAlert,
    addBreakdownEquipment,
    submitReorderRequest,
    resolveBreakdown,
  } = useBreakdownStore();

  const [isAddBreakdownModalOpen, setIsAddBreakdownModalOpen] = useState(false);
  const [breakdownAlertToRespond, setBreakdownAlertToRespond] = useState(null);

  const [selectedLabId, setSelectedLabId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [alertTab, setAlertTab] = useState("active");
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [isActiveAlertsLoading, setIsActiveAlertsLoading] = useState(true);
  const [historyAlerts, setHistoryAlerts] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Ensure user profile is fully loaded
  useEffect(() => {
    const ensureUserDataLoaded = async () => {
      if (!user?.institute) {
        try {
          await checkAuth();
        } catch (error) {
          console.error("Failed to load user profile:", error);
        }
      }
      setIsInitialLoad(false);
    };

    ensureUserDataLoaded();
  }, []);

  // Initial Data Load
  useEffect(() => {
    if (!isInitialLoad && user) {
      loadDashboardData();
      fetchBreakdownEquipment();
    }
  }, [isInitialLoad, user?.id]);

  const parseAlertResponse = (response) => {
    if (Array.isArray(response)) return response;
    if (response && response.data && Array.isArray(response.data))
      return response.data;
    return [];
  };

  const fetchActiveAlertsIsolated = async () => {
    setIsActiveAlertsLoading(true);
    try {
      const response = await fetchAlerts({ isResolved: false });
      setActiveAlerts(parseAlertResponse(response));
    } catch (error) {
      console.error("Failed to fetch active alerts:", error);
    } finally {
      setIsActiveAlertsLoading(false);
    }
  };

  const fetchHistoryAlertsIsolated = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await fetchAlerts({ isResolved: true, limit: 50 });
      setHistoryAlerts(parseAlertResponse(response));
    } catch (error) {
      console.error("Failed to fetch history alerts:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log("📊 Loading Lab Manager Dashboard data...");
      await Promise.all([
        fetchOverview(),
        fetchEquipment(),
        fetchLabs(),
        fetchActiveAlertsIsolated(),
      ]);
      console.log("✅ Dashboard data loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load dashboard data:", error);
    }
  };

  const handleTabChange = (tab) => {
    setAlertTab(tab);
    if (tab === "history" && historyAlerts.length === 0) {
      fetchHistoryAlertsIsolated();
    }
    if (tab === "active") {
      fetchActiveAlertsIsolated();
    }
  };

  const handleSelectLab = (labId) => {
    if (labId === selectedLabId) {
      setSelectedLabId("all");
      fetchEquipment();
    } else {
      setSelectedLabId(labId);
      fetchEquipment({ labId: labId });
    }
  };

  const handleLabClick = (labId) => {
    navigate(`/dashboard/lab-analytics/${labId}`);
  };

  const handleCreateEquipment = async (data) => {
    try {
      await createEquipment(data);
      setIsModalOpen(false);
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to create equipment:", error);
      throw error;
    }
  };

  const handleUpdateEquipment = async (id, data) => {
    try {
      await updateEquipment(id, data);
      setIsModalOpen(false);
      setEditingEquipment(null);
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to update equipment:", error);
      throw error;
    }
  };

  const handleDeleteEquipment = async (id) => {
    if (!window.confirm("Are you sure you want to delete this equipment?")) {
      return;
    }
    try {
      await deleteEquipment(id);
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to delete equipment:", error);
      alert("Failed to delete equipment. Please try again.");
    }
  };

  const handleEditClick = (equipment) => {
    setEditingEquipment(equipment);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEquipment(null);
  };

  const handleAlertClick = (alert) => {
    if (alert.type === "EQUIPMENT_BREAKDOWN_CHECK") {
      setBreakdownAlertToRespond(alert);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      const alert = activeAlerts.find((a) => a.id === alertId);

      if (alert?.type === "EQUIPMENT_BREAKDOWN_CHECK") {
        setBreakdownAlertToRespond(alert);
        return;
      }

      await resolveAlert(alertId);
      fetchOverview();
      await fetchActiveAlertsIsolated();

      if (historyAlerts.length > 0 || alertTab === "history") {
        fetchHistoryAlertsIsolated();
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
      alert("Failed to resolve alert. Please try again.");
    }
  };

  const getFilteredEquipment = () => {
    let filtered = equipment;

    if (selectedStatus !== "all") {
      filtered = filtered.filter((eq) => eq.status?.status === selectedStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (eq) =>
          eq.name.toLowerCase().includes(query) ||
          eq.equipmentId.toLowerCase().includes(query) ||
          eq.manufacturer.toLowerCase().includes(query) ||
          eq.model.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const convertToCSV = (data) => {
    if (!data.length) return "";
    const headers = [
      "Equipment ID",
      "Name",
      "Department",
      "Lab",
      "Status",
      "Manufacturer",
      "Model",
      "Purchase Date",
    ];
    const rows = data.map((eq) => [
      eq.equipmentId,
      eq.name,
      eq.department,
      eq.lab?.name || "",
      eq.status?.status || "",
      eq.manufacturer,
      eq.model,
      new Date(eq.purchaseDate).toLocaleDateString(),
    ]);
    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportData = () => {
    const filteredData = getFilteredEquipment();
    const csv = convertToCSV(filteredData);
    downloadCSV(csv, `equipment-${new Date().toISOString().split("T")[0]}.csv`);
  };

  if (isInitialLoad || dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: Activity,
      title: "Total Equipment",
      value: overview?.overview?.totalEquipment || 0,
    },
    {
      icon: TrendingUp,
      title: "Active Equipment",
      value: overview?.overview?.activeEquipment || 0,
    },
    {
      icon: AlertTriangle,
      title: "Unresolved Alerts",
      value: overview?.overview?.unresolvedAlerts || 0,
    },
    {
      icon: Wrench,
      title: "Maintenance Due",
      value: overview?.overview?.maintenanceDue || 0,
    },
  ];

  const filteredEquipment = getFilteredEquipment();

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Lab Manager Dashboard
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              {getInstituteName(user?.institute)} |{" "}
              {DEPARTMENT_DISPLAY_NAMES[user?.department] ||
                user?.department ||
                "Unknown Department"}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Equipment
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full flex flex-col gap-3">
          {/* Stats Cards */}
          <div className="flex-shrink-0 grid grid-cols-4 gap-3">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          {/* Filters */}
          <div className="flex-shrink-0 bg-white rounded-lg shadow-sm p-3 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search Equipment
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, model..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="OPERATIONAL">Operational</option>
                  <option value="IN_USE">In Use</option>
                  <option value="IN_CLASS">In Class</option>
                  <option value="IDLE">Idle</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="FAULTY">Faulty</option>
                  <option value="OFFLINE">Offline</option>
                  <option value="WARNING">Warning</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                Showing {filteredEquipment.length} equipment
              </p>
              <button
                onClick={handleExportData}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3 h-3" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="flex-1 overflow-hidden grid grid-cols-12 gap-3">
            {/* Left Column - My Labs ONLY */}
            <div className="col-span-3 overflow-hidden flex flex-col">
              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="flex-shrink-0 p-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold">My Labs</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {labLoading ? (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner />
                    </div>
                  ) : labs.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-4">
                      No labs found for your department.
                    </p>
                  ) : (
                    labs.map((lab) => (
                      <div
                        key={lab.id}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          selectedLabId === lab.labId
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-100 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <button
                            onClick={() => handleLabClick(lab.labId)}
                            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors cursor-pointer group"
                          >
                            <Building className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-600" />
                            <h4 className="font-medium text-gray-900 text-xs group-hover:underline group-hover:text-blue-600">
                              {lab.name}
                            </h4>
                            <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <span className="text-xs font-bold text-blue-600">
                            {lab._count?.equipments || 0}
                          </span>
                        </div>
                        <button
                          onClick={() => handleSelectLab(lab.labId)}
                          className="text-xs text-gray-600 hover:text-gray-800 flex items-center gap-1"
                        >
                          {selectedLabId === lab.labId
                            ? "Clear Filter"
                            : "Filter Equipment"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Equipment + Breakdown + Alerts */}
            <div className="col-span-9 space-y-3 overflow-hidden flex flex-col">
              {/* Equipment Table */}
              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className="flex-shrink-0 p-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold">
                    Equipment{" "}
                    {selectedLabId !== "all"
                      ? `(Lab: ${
                          labs.find((l) => l.labId === selectedLabId)?.name
                        })`
                      : "(All Labs)"}
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {equipmentLoading ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinner />
                    </div>
                  ) : filteredEquipment.length === 0 ? (
                    <div className="text-center py-8">
                      <Activity className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        No equipment found
                      </p>
                      {selectedLabId === "all" && (
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Add your first equipment
                        </button>
                      )}
                    </div>
                  ) : (
                    <EquipmentTable
                      equipment={filteredEquipment}
                      onEdit={handleEditClick}
                      onDelete={handleDeleteEquipment}
                      showActions={true}
                    />
                  )}
                </div>
              </div>

              {/* Bottom Row - Breakdown + Alerts */}
              <div className="flex-shrink-0 grid grid-cols-2 gap-3 h-64">
                {/* Breakdown Equipment */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                  <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      Breakdown ({breakdownEquipment.length})
                    </h2>
                    <button
                      onClick={() => setIsAddBreakdownModalOpen(true)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Report
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {breakdownEquipment.length === 0 ? (
                      <p className="text-xs text-gray-600 text-center py-4">
                        No breakdowns reported yet.
                      </p>
                    ) : (
                      <BreakdownEquipmentTable
                        breakdowns={breakdownEquipment}
                        onReorder={async (id, data) => {
                          await submitReorderRequest(id, data);
                          await fetchBreakdownEquipment();
                        }}
                        onResolve={async (id) => {
                          await resolveBreakdown(id);
                          await fetchBreakdownEquipment();
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Alerts Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                  <div className="flex-shrink-0 p-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Alerts</h2>

                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => handleTabChange("active")}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                          alertTab === "active"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <List className="w-3 h-3" />
                        Active
                      </button>
                      <button
                        onClick={() => handleTabChange("history")}
                        className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                          alertTab === "history"
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-gray-600 hover:text-gray-900"
                        }`}
                      >
                        <History className="w-3 h-3" />
                        History
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {alertTab === "active" ? (
                      isActiveAlertsLoading ? (
                        <div className="flex justify-center py-6">
                          <LoadingSpinner />
                        </div>
                      ) : (
                        <AlertsList
                          alerts={activeAlerts}
                          onResolve={handleResolveAlert}
                        />
                      )
                    ) : (
                      <AlertHistoryTable
                        alerts={historyAlerts}
                        loading={isHistoryLoading}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {breakdownAlertToRespond && (
        <BreakdownAlertModal
          isOpen={!!breakdownAlertToRespond}
          onClose={() => setBreakdownAlertToRespond(null)}
          alert={breakdownAlertToRespond}
          onRespond={async (alertId, isBreakdown, reason) => {
            await respondToBreakdownAlert(alertId, isBreakdown, reason);
            await Promise.all([
              fetchActiveAlertsIsolated(),
              fetchBreakdownEquipment(),
              fetchOverview(),
            ]);
          }}
        />
      )}

      {isAddBreakdownModalOpen && (
        <AddBreakdownModal
          isOpen={isAddBreakdownModalOpen}
          onClose={() => setIsAddBreakdownModalOpen(false)}
          onSubmit={async (equipmentId, reason) => {
            await addBreakdownEquipment(equipmentId, reason);
            await fetchBreakdownEquipment();
          }}
        />
      )}

      {isModalOpen && (
        <EquipmentFormModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSubmit={
            editingEquipment ? handleUpdateEquipment : handleCreateEquipment
          }
          equipment={editingEquipment}
        />
      )}
    </div>
  );
}
