/*
 * =====================================================
 * frontend/src/components/sld/EquipmentNode.jsx (NEW)
 * =====================================================
 */
import { useState } from "react";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Wrench,
  Power,
  GraduationCap,
  Info
} from "lucide-react";

const STATUS_CONFIG = {
  OPERATIONAL: {
    color: "bg-green-500",
    borderColor: "border-green-500",
    textColor: "text-green-700",
    icon: CheckCircle,
    label: "Operational"
  },
  IN_USE: {
    color: "bg-blue-500",
    borderColor: "border-blue-500",
    textColor: "text-blue-700",
    icon: Activity,
    label: "In Use"
  },
  IN_CLASS: {
    color: "bg-purple-500",
    borderColor: "border-purple-500",
    textColor: "text-purple-700",
    icon: GraduationCap,
    label: "In Class"
  },
  IDLE: {
    color: "bg-gray-400",
    borderColor: "border-gray-400",
    textColor: "text-gray-700",
    icon: Clock,
    label: "Idle"
  },
  MAINTENANCE: {
    color: "bg-yellow-500",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-700",
    icon: Wrench,
    label: "Maintenance"
  },
  FAULTY: {
    color: "bg-red-500",
    borderColor: "border-red-500",
    textColor: "text-red-700",
    icon: XCircle,
    label: "Faulty"
  },
  OFFLINE: {
    color: "bg-gray-600",
    borderColor: "border-gray-600",
    textColor: "text-gray-700",
    icon: Power,
    label: "Offline"
  },
  WARNING: {
    color: "bg-orange-500",
    borderColor: "border-orange-500",
    textColor: "text-orange-700",
    icon: AlertTriangle,
    label: "Warning"
  },
};

export default function EquipmentNode({ equipment }) {
  const [showDetails, setShowDetails] = useState(false);
  
  const status = equipment.status?.status || "OFFLINE";
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.OFFLINE;
  const StatusIcon = config.icon;
  
  const healthScore = equipment.status?.healthScore || 0;
  const unresolvedAlerts = equipment._count?.alerts || 0;

  const getHealthColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="relative group">
      {/* Equipment Box */}
      <div
        className={`
          relative w-full min-w-[200px] max-w-[280px] p-4 rounded-lg border-4 
          ${config.borderColor} bg-white shadow-lg 
          hover:shadow-xl transition-all duration-300 cursor-pointer
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Status Indicator Badge */}
        <div className={`absolute -top-3 -right-3 ${config.color} rounded-full p-2 shadow-lg`}>
          <StatusIcon className="w-5 h-5 text-white" />
        </div>

        {/* Alert Badge */}
        {unresolvedAlerts > 0 && (
          <div className="absolute -top-3 -left-3 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg">
            {unresolvedAlerts}
          </div>
        )}

        {/* Equipment Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">
              {equipment.name}
            </h3>
          </div>
          
          <p className="text-xs text-gray-600 font-mono">
            {equipment.equipmentId}
          </p>

          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600">Status:</span>
              <span className={`text-xs font-semibold ${config.textColor}`}>
                {config.label}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Health:</span>
              <span className={`text-xs font-bold ${getHealthColor(healthScore)}`}>
                {healthScore.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Hover indicator */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Info className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Detailed Popup */}
      {showDetails && (
        <div 
          className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-4 w-80 bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={() => setShowDetails(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>

          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-lg text-gray-900">{equipment.name}</h4>
              <p className="text-sm text-gray-600">{equipment.equipmentId}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-gray-600">Manufacturer:</p>
                <p className="font-semibold">{equipment.manufacturer}</p>
              </div>
              <div>
                <p className="text-gray-600">Model:</p>
                <p className="font-semibold">{equipment.model}</p>
              </div>
            </div>

            {equipment.serialNumber && (
              <div className="text-sm">
                <p className="text-gray-600">Serial Number:</p>
                <p className="font-semibold font-mono">{equipment.serialNumber}</p>
              </div>
            )}

            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Status:</span>
                <div className="flex items-center gap-2">
                  <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
                  <span className={`font-semibold ${config.textColor}`}>
                    {config.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Health Score:</span>
                <span className={`font-bold ${getHealthColor(healthScore)}`}>
                  {healthScore.toFixed(1)}%
                </span>
              </div>

              {equipment.status?.temperature && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Temperature:</span>
                  <span className="font-semibold">
                    {equipment.status.temperature.toFixed(1)}°C
                  </span>
                </div>
              )}

              {equipment.status?.isOperatingInClass && (
                <div className="flex items-center gap-2 bg-purple-50 p-2 rounded">
                  <GraduationCap className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-700 font-medium">
                    Currently in class
                  </span>
                </div>
              )}

              {unresolvedAlerts > 0 && (
                <div className="flex items-center gap-2 bg-red-50 p-2 rounded">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700 font-medium">
                    {unresolvedAlerts} unresolved alert{unresolvedAlerts > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {equipment.status?.lastUsedAt && (
              <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                Last used: {new Date(equipment.status.lastUsedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}