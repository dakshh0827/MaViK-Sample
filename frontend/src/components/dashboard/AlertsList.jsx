// =====================================================
// 14. src/components/dashboard/AlertsList.jsx
// =====================================================

export default function AlertsList({ alerts, onResolve }) {
  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: "bg-red-100 text-red-800 border-red-200",
      HIGH: "bg-orange-100 text-orange-800 border-orange-200",
      MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
      LOW: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return colors[severity] || colors.LOW;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Alerts</h3>
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No unresolved alerts</p>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-lg border ${getSeverityColor(
                alert.severity
              )}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="font-medium mb-1">{alert.title}</h4>
                  <p className="text-sm">{alert.message}</p>
                  {alert.equipment && (
                    <p className="text-xs mt-1 text-gray-600">
                      Equipment: {alert.equipment.name}
                    </p>
                  )}
                </div>
                {!alert.isResolved && onResolve && (
                  <button
                    onClick={() => onResolve(alert.id)}
                    className="ml-4 px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
