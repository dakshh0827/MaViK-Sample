import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLabStore } from "../../stores/labStore";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import api from "../../lib/axios";
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
  ArrowLeft,
  Activity,
  Box,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Wrench,
  Calendar,
  AlertCircle,
} from "lucide-react";

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

// Predictive Maintenance Calculator
const calculateNextMaintenance = (equipment) => {
  const params = equipment.analyticsParams;
  const status = equipment.status;

  if (!params || !status) {
    return {
      daysUntilMaintenance: null,
      confidence: 0,
      priority: "UNKNOWN",
      factors: [],
    };
  }

  // Scoring factors (0-100, lower is worse)
  const healthScore = status.healthScore || 50;
  const efficiency = params.efficiency || 50;
  const uptime = params.totalUptime || 0;
  const downtime = params.totalDowntime || 0;
  const utilizationRate = params.utilizationRate || 50;

  // Calculate wear score (0-100)
  const wearScore = (downtime / (uptime + downtime + 1)) * 100;

  // Temperature factor (assuming 20-80°C is normal range)
  const tempScore = params.temperature
    ? Math.max(0, 100 - Math.abs(params.temperature - 50) * 2)
    : 50;

  // Vibration factor (higher vibration = worse condition)
  const vibrationScore = params.vibration
    ? Math.max(0, 100 - params.vibration * 20)
    : 50;

  // Combined health indicator (weighted average)
  const combinedScore =
    healthScore * 0.3 +
    efficiency * 0.2 +
    tempScore * 0.15 +
    vibrationScore * 0.15 +
    utilizationRate * 0.1 +
    (100 - wearScore) * 0.1;

  // Calculate days until maintenance based on combined score
  let daysUntilMaintenance;
  let priority;

  if (combinedScore >= 80) {
    daysUntilMaintenance = Math.floor(90 + (combinedScore - 80) * 2);
    priority = "LOW";
  } else if (combinedScore >= 60) {
    daysUntilMaintenance = Math.floor(30 + ((combinedScore - 60) / 20) * 60);
    priority = "MEDIUM";
  } else if (combinedScore >= 40) {
    daysUntilMaintenance = Math.floor(7 + ((combinedScore - 40) / 20) * 23);
    priority = "HIGH";
  } else {
    daysUntilMaintenance = Math.floor((combinedScore / 40) * 7);
    priority = "CRITICAL";
  }

  // Confidence based on data availability
  const dataAvailability = [
    healthScore !== 50,
    efficiency !== 50,
    params.temperature != null,
    params.vibration != null,
    uptime > 0,
  ].filter(Boolean).length;

  const confidence = (dataAvailability / 5) * 100;

  // Identify contributing factors
  const factors = [];
  if (healthScore < 70) factors.push("Low health score");
  if (efficiency < 60) factors.push("Poor efficiency");
  if (wearScore > 30) factors.push("High wear rate");
  if (
    params.temperature &&
    (params.temperature > 70 || params.temperature < 30)
  ) {
    factors.push("Abnormal temperature");
  }
  if (params.vibration && params.vibration > 3) factors.push("High vibration");

  return {
    daysUntilMaintenance,
    confidence: Math.round(confidence),
    priority,
    factors,
    combinedScore: Math.round(combinedScore),
  };
};

const PredictiveMaintenanceCard = ({ equipment }) => {
  const prediction = calculateNextMaintenance(equipment);

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return "red";
      case "HIGH":
        return "orange";
      case "MEDIUM":
        return "yellow";
      case "LOW":
        return "green";
      default:
        return "gray";
    }
  };

  const getPriorityBg = (priority) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-red-50 border-red-200";
      case "HIGH":
        return "bg-orange-50 border-orange-200";
      case "MEDIUM":
        return "bg-yellow-50 border-yellow-200";
      case "LOW":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const estimatedDate =
    prediction.daysUntilMaintenance != null
      ? new Date(
          Date.now() + prediction.daysUntilMaintenance * 24 * 60 * 60 * 1000
        )
      : null;

  return (
    <div
      className={`p-3 rounded-lg border-2 ${getPriorityBg(
        prediction.priority
      )}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm text-gray-900 mb-1">
            {equipment.name}
          </h4>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-600">
              {prediction.daysUntilMaintenance != null
                ? `${prediction.daysUntilMaintenance} days`
                : "Insufficient data"}
            </span>
          </div>
          {estimatedDate && (
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-600">
                {estimatedDate.toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        <div className="text-center">
          <span
            className={`px-2 py-1 rounded text-xs font-semibold bg-${getPriorityColor(
              prediction.priority
            )}-100 text-${getPriorityColor(prediction.priority)}-800`}
          >
            {prediction.priority}
          </span>
          <div className="mt-1 text-xs text-gray-500">
            {prediction.confidence}% confidence
          </div>
        </div>
      </div>

      {prediction.factors.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-start gap-1">
            <AlertCircle className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-600">
              {prediction.factors.join(", ")}
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Health:</span>
          <span className="font-semibold">{prediction.combinedScore}%</span>
        </div>
      </div>
    </div>
  );
};

export default function LabAnalyticsPage() {
  const { labId } = useParams();
  const navigate = useNavigate();
  const { labSummary, fetchLabSummary, isLoading: labLoading } = useLabStore();
  const [labAnalytics, setLabAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setAnalyticsLoading(true);
        await fetchLabSummary(labId);
        const response = await api.get(`/monitoring/lab-analytics/${labId}`);
        setLabAnalytics(response.data.data);
      } catch (error) {
        console.error("Failed to fetch lab analytics:", error);
      } finally {
        setAnalyticsLoading(false);
      }
    };

    fetchData();
  }, [labId]);

  const prepareAnalyticsData = () => {
    if (!labAnalytics || !labAnalytics.equipment) return null;

    const equipment = labAnalytics.equipment;

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

    const healthScoreData = equipment.map((eq) => ({
      name: eq.name.substring(0, 20),
      healthScore: eq.status?.healthScore || 0,
      efficiency: eq.analyticsParams?.efficiency || 0,
    }));

    const performanceData = equipment
      .filter((eq) => eq.analyticsParams)
      .map((eq) => ({
        name: eq.name.substring(0, 15),
        efficiency: eq.analyticsParams.efficiency || 0,
        uptime: eq.analyticsParams.totalUptime || 0,
        downtime: eq.analyticsParams.totalDowntime || 0,
        utilization: eq.analyticsParams.utilizationRate || 0,
      }));

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

  if (labLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Lab Analytics: {labSummary?.lab?.name || "Loading..."}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {labAnalytics?.lab?.institute?.name || ""} •{" "}
                {labAnalytics?.lab?.department || ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Fixed Height with Internal Scrolling */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col gap-4 p-6">
          {/* Summary Stats - Fixed at Top */}
          {labSummary && (
            <div className="flex-shrink-0 grid grid-cols-5 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <Box className="w-6 h-6 text-blue-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {labSummary.statistics?.totalEquipment || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  Total Equipment
                </p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {labSummary.statistics?.avgHealthScore?.toFixed(0) || 0}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  Avg Health Score
                </p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all"
                    style={{
                      width: `${labSummary.statistics?.avgHealthScore || 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {labSummary.statistics?.totalUptime?.toFixed(1) || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  Total Uptime (hrs)
                </p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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

              <div className="bg-white rounded-lg p-4 shadow-sm border border-red-100">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">
                    {labSummary.statistics?.totalDowntime?.toFixed(1) || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  Total Downtime (hrs)
                </p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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

              <div className="bg-white rounded-lg p-4 shadow-sm border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {labSummary.statistics?.inClassEquipment || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">
                  In-Class Equipment
                </p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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

          {/* Charts Section - Scrollable */}
          {analyticsData && labAnalytics && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-4 pb-4">
                {/* Predictive Maintenance Section */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Predictive Maintenance Schedule
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {labAnalytics.equipment
                      .filter((eq) => eq.analyticsParams)
                      .sort((a, b) => {
                        const aPred = calculateNextMaintenance(a);
                        const bPred = calculateNextMaintenance(b);
                        const priorityOrder = {
                          CRITICAL: 0,
                          HIGH: 1,
                          MEDIUM: 2,
                          LOW: 3,
                        };
                        return (
                          priorityOrder[aPred.priority] -
                          priorityOrder[bPred.priority]
                        );
                      })
                      .map((eq) => (
                        <PredictiveMaintenanceCard key={eq.id} equipment={eq} />
                      ))}
                  </div>
                </div>

                {/* Equipment Status & Health Score */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <PieChartIcon className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Equipment Status
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={analyticsData.statusChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={60}
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

                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 col-span-3">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="w-4 h-4 text-green-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Health Score & Efficiency
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={analyticsData.healthScoreData.slice(0, 8)}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
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

                {/* Uptime vs Downtime & Radar Chart */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <LineChartIcon className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Uptime vs Downtime Analysis
                      </h3>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={analyticsData.uptimeDowntimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          label={{
                            value: "Hours",
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 10 },
                          }}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
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

                  {analyticsData.radarMetrics.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          Department Performance Radar
                        </h3>
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={analyticsData.radarMetrics}>
                          <PolarGrid />
                          <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fontSize: 10 }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fontSize: 10 }}
                          />
                          <Radar
                            name="Performance"
                            dataKey="value"
                            stroke="#8B5CF6"
                            fill="#8B5CF6"
                            fillOpacity={0.6}
                          />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Equipment Details Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Equipment Details
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Equipment
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Health
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Efficiency
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Temperature
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Uptime
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Next Maintenance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {labAnalytics.equipment.map((eq) => {
                          const prediction = calculateNextMaintenance(eq);
                          return (
                            <tr key={eq.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                {eq.name}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full ${
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
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                <div className="flex items-center">
                                  <span className="mr-2">
                                    {eq.status?.healthScore?.toFixed(0) || 0}%
                                  </span>
                                  <div className="w-12 bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full ${
                                        (eq.status?.healthScore || 0) >= 80
                                          ? "bg-green-500"
                                          : (eq.status?.healthScore || 0) >= 50
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                      }`}
                                      style={{
                                        width: `${
                                          eq.status?.healthScore || 0
                                        }%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                {eq.analyticsParams?.efficiency?.toFixed(1) ||
                                  "N/A"}
                                %
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                {eq.analyticsParams?.temperature?.toFixed(1) ||
                                  "N/A"}
                                °C
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                {eq.analyticsParams?.totalUptime?.toFixed(1) ||
                                  "N/A"}
                                h
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {prediction.daysUntilMaintenance != null ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-900">
                                      {prediction.daysUntilMaintenance} days
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 text-xs rounded ${
                                        prediction.priority === "CRITICAL"
                                          ? "bg-red-100 text-red-700"
                                          : prediction.priority === "HIGH"
                                          ? "bg-orange-100 text-orange-700"
                                          : prediction.priority === "MEDIUM"
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-green-100 text-green-700"
                                      }`}
                                    >
                                      {prediction.priority}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    No data
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
