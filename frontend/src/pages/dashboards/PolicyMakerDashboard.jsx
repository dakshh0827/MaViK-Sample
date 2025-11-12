// =====================================================
// 21. src/pages/dashboards/PolicyMakerDashboard.jsx
// =====================================================

import { useEffect, useState } from "react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useAlertStore } from "../../stores/alertStore";
import StatCard from "../../components/common/StatCard";
import AlertsList from "../../components/dashboard/AlertsList";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { Activity, Building, AlertTriangle, TrendingUp } from "lucide-react";

export default function PolicyMakerDashboard() {
  const { overview, fetchOverview, isLoading } = useDashboardStore();
  const { alerts, fetchAlerts, resolveAlert } = useAlertStore();
  const [selectedInstitute, setSelectedInstitute] = useState("all");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([fetchOverview(), fetchAlerts({ isResolved: false })]);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const stats = [
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

  const institutions = overview?.institutions || [];
  const filteredInstitutions =
    selectedInstitute === "all"
      ? institutions
      : institutions.filter((inst) => inst.name === selectedInstitute);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Policy Maker Dashboard
        </h1>
        <p className="text-gray-600 mt-1">
          Centralized view of all institutions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Institute Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <div className="flex items-center gap-4">
          <Building className="w-5 h-5 text-gray-600" />
          <select
            value={selectedInstitute}
            onChange={(e) => setSelectedInstitute(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Institutions</option>
            {institutions.map((inst) => (
              <option key={inst.name} value={inst.name}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Institutions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstitutions.map((inst) => (
          <div
            key={inst.name}
            className="bg-white rounded-lg shadow-sm p-6 border border-gray-100"
          >
            <h3 className="text-lg font-semibold mb-4">{inst.name}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Labs:</span>
                <span className="font-medium">{inst.labCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Equipment:</span>
                <span className="font-medium">{inst.equipmentCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Alerts:</span>
                <span className="font-medium text-red-600">
                  {inst.unresolvedAlerts}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Critical Alerts</h2>
          <AlertsList
            alerts={alerts
              .filter((a) => a.severity === "CRITICAL")
              .slice(0, 10)}
            onResolve={resolveAlert}
          />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Alerts</h2>
          <AlertsList alerts={alerts.slice(0, 5)} />
        </div>
      </div>
    </div>
  );
}
