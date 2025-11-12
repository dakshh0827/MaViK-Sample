// =====================================================
// 20. src/pages/dashboards/LabTechnicianDashboard.jsx
// =====================================================

import { useEffect, useState } from "react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useEquipmentStore } from "../../stores/equipmentStore";
import { useAlertStore } from "../../stores/alertStore";
import { useAuthStore } from "../../stores/authStore";
import StatCard from "../../components/common/StatCard";
import EquipmentTable from "../../components/dashboard/EquipmentTable";
import AlertsList from "../../components/dashboard/AlertsList";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import {
  Activity,
  AlertTriangle,
  Wrench,
  TrendingUp,
  Building,
} from "lucide-react";

export default function LabTechnicianDashboard() {
  const { user } = useAuthStore();
  const {
    overview,
    fetchOverview,
    isLoading: dashboardLoading,
  } = useDashboardStore();
  const { equipment, fetchEquipment } = useEquipmentStore();
  const { alerts, fetchAlerts, resolveAlert } = useAlertStore();
  const [selectedLab, setSelectedLab] = useState("all");
  const [equipmentByLab, setEquipmentByLab] = useState({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    // Group equipment by lab
    if (equipment.length > 0) {
      const grouped = equipment.reduce((acc, eq) => {
        const labName = eq.lab?.name || "Unknown";
        if (!acc[labName]) acc[labName] = [];
        acc[labName].push(eq);
        return acc;
      }, {});
      setEquipmentByLab(grouped);
    }
  }, [equipment]);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        fetchOverview(),
        fetchEquipment({ institute: user?.institute }),
        fetchAlerts({ isResolved: false }),
      ]);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
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

  const filteredEquipment =
    selectedLab === "all" ? equipment : equipmentByLab[selectedLab] || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Lab Technician Dashboard
        </h1>
        <p className="text-gray-600 mt-1">
          Institute: {user?.institute || "Unknown"}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Lab Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <div className="flex items-center gap-4">
          <Building className="w-5 h-5 text-gray-600" />
          <select
            value={selectedLab}
            onChange={(e) => setSelectedLab(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Labs</option>
            {Object.keys(equipmentByLab).map((labName) => (
              <option key={labName} value={labName}>
                {labName} ({equipmentByLab[labName].length} equipment)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment Table */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">
            Equipment {selectedLab !== "all" && `- ${selectedLab}`}
          </h2>
          <EquipmentTable equipment={filteredEquipment} onSelect={() => {}} />
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Alerts</h2>
          <AlertsList alerts={alerts.slice(0, 5)} onResolve={resolveAlert} />
        </div>
      </div>

      {/* Equipment by Lab Summary */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
        <h3 className="text-lg font-semibold mb-4">Equipment by Lab</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(equipmentByLab).map(([labName, items]) => (
            <div key={labName} className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{labName}</h4>
              <p className="text-2xl font-bold text-blue-900">{items.length}</p>
              <p className="text-sm text-gray-600">equipment</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
