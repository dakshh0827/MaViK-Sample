// =====================================================
// 25. src/pages/SLDPage.jsx (Single Line Diagram)
// =====================================================

import { useEffect, useState } from "react";
import { useEquipmentStore } from "../stores/equipmentStore";
import { useAuthStore } from "../stores/authStore";
import LoadingSpinner from "../components/common/LoadingSpinner";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react";

export default function SLDPage() {
  const { user } = useAuthStore();
  const { equipment, fetchEquipment, isLoading } = useEquipmentStore();
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const filters = user?.role === "TRAINER" ? { labId: user.labId } : {};
    fetchEquipment(filters);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case "OPERATIONAL":
      case "IN_USE":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "MAINTENANCE":
        return <Zap className="w-5 h-5 text-yellow-600" />;
      case "FAULTY":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "OFFLINE":
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "OPERATIONAL":
      case "IN_USE":
        return "border-green-500 bg-green-50";
      case "MAINTENANCE":
        return "border-yellow-500 bg-yellow-50";
      case "FAULTY":
        return "border-red-500 bg-red-50";
      case "OFFLINE":
        return "border-gray-300 bg-gray-50";
      default:
        return "border-gray-300 bg-white";
    }
  };

  // Filter equipment
  const filteredEquipment = equipment.filter((eq) => {
    if (selectedDepartment !== "all" && eq.department !== selectedDepartment)
      return false;
    if (selectedStatus !== "all" && eq.status?.status !== selectedStatus)
      return false;
    return true;
  });

  // Get unique departments
  const departments = [...new Set(equipment.map((eq) => eq.department))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Single Line Diagram (SLD) View
        </h1>
        <p className="text-gray-600 mt-1">
          Visual representation of equipment in linear flowchart format
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="OPERATIONAL">Operational</option>
              <option value="IN_USE">In Use</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="FAULTY">Faulty</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
        <h3 className="font-medium mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm">Operational / In Use</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-600" />
            <span className="text-sm">Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm">Faulty</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-gray-400" />
            <span className="text-sm">Offline</span>
          </div>
        </div>
      </div>

      {/* SLD Flowchart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        {filteredEquipment.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No equipment found matching the selected filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-center gap-4 min-w-max pb-4">
              {filteredEquipment.map((eq, index) => (
                <div key={eq.id} className="flex items-center">
                  {/* Equipment Card */}
                  <div
                    className={`border-2 rounded-lg p-4 w-64 ${getStatusColor(
                      eq.status?.status
                    )}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      {getStatusIcon(eq.status?.status)}
                      <span className="text-xs font-medium px-2 py-1 bg-white rounded">
                        {eq.status?.status || "OFFLINE"}
                      </span>
                    </div>
                    <h3 className="font-semibold text-sm mb-1">
                      {eq.equipmentId}
                    </h3>
                    <p className="text-sm text-gray-700 mb-2">{eq.name}</p>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>Dept: {eq.department}</p>
                      <p>Lab: {eq.lab?.name}</p>
                      {eq.status?.healthScore !== undefined && (
                        <p>
                          Health:{" "}
                          <span
                            className={
                              eq.status.healthScore >= 80
                                ? "text-green-600 font-medium"
                                : eq.status.healthScore >= 60
                                ? "text-yellow-600 font-medium"
                                : "text-red-600 font-medium"
                            }
                          >
                            {eq.status.healthScore}%
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Connector Arrow */}
                  {index < filteredEquipment.length - 1 && (
                    <div className="flex items-center px-2">
                      <div className="w-8 h-0.5 bg-gray-300"></div>
                      <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-gray-300"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Total Equipment</p>
          <p className="text-2xl font-bold text-gray-900">
            {filteredEquipment.length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Operational</p>
          <p className="text-2xl font-bold text-green-600">
            {
              filteredEquipment.filter((eq) =>
                ["OPERATIONAL", "IN_USE"].includes(eq.status?.status)
              ).length
            }
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Maintenance</p>
          <p className="text-2xl font-bold text-yellow-600">
            {
              filteredEquipment.filter(
                (eq) => eq.status?.status === "MAINTENANCE"
              ).length
            }
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-sm text-gray-600 mb-1">Faulty</p>
          <p className="text-2xl font-bold text-red-600">
            {
              filteredEquipment.filter((eq) => eq.status?.status === "FAULTY")
                .length
            }
          </p>
        </div>
      </div>
    </div>
  );
}
