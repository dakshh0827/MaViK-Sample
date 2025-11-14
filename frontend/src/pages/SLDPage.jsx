/*
 * =====================================================
 * frontend/src/pages/SLDPage.jsx (NEW)
 * =====================================================
 */
import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "../stores/authStore";
import { useLabStore } from "../stores/labStore";
import { useEquipmentStore } from "../stores/equipmentStore";
import { useInstituteStore } from "../stores/instituteStore";
import LoadingSpinner from "../components/common/LoadingSpinner";
import EquipmentNode from "../components/sld/EquipmentNode";
import { Filter, AlertCircle } from "lucide-react";

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

const STATUS_COLORS = {
  OPERATIONAL: "bg-green-500",
  IN_USE: "bg-blue-500",
  IN_CLASS: "bg-purple-500",
  IDLE: "bg-gray-400",
  MAINTENANCE: "bg-yellow-500",
  FAULTY: "bg-red-500",
  OFFLINE: "bg-gray-600",
  WARNING: "bg-orange-500",
};

export default function SLDPage() {
  const { user } = useAuthStore();
  const { labs, fetchLabs, isLoading: labsLoading } = useLabStore();
  const { equipment, fetchEquipment, isLoading: equipmentLoading } = useEquipmentStore();
  const { institutes, fetchInstitutes, isLoading: institutesLoading } = useInstituteStore();

  // Filter states
  const [selectedInstitute, setSelectedInstitute] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedLab, setSelectedLab] = useState("all");
  const [gridColumns, setGridColumns] = useState(3); // Number of columns in grid

  useEffect(() => {
    const loadData = async () => {
      try {
        // Policy Maker sees all institutes, Lab Manager sees only their institute
        if (user.role === "POLICY_MAKER") {
          await fetchInstitutes();
        }
        await fetchLabs();
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };
    loadData();
  }, []);

  // Filter logic based on user role
  const availableInstitutes = useMemo(() => {
    if (user.role === "POLICY_MAKER") {
      return institutes;
    } else if (user.role === "LAB_MANAGER") {
      // Lab Manager only sees their institute
      return institutes.filter(inst => inst.instituteId === user.instituteId);
    }
    return [];
  }, [institutes, user]);

  const availableDepartments = useMemo(() => {
    if (user.role === "LAB_MANAGER") {
      // Lab Manager only sees their department
      return [user.department];
    }
    
    // Policy Maker sees all departments
    let filteredLabs = labs;
    if (selectedInstitute !== "all") {
      filteredLabs = labs.filter(lab => lab.instituteId === selectedInstitute);
    }
    return [...new Set(filteredLabs.map(lab => lab.department))].sort();
  }, [labs, selectedInstitute, user]);

  const availableLabs = useMemo(() => {
    let filteredLabs = labs;

    if (user.role === "LAB_MANAGER") {
      // Lab Manager sees only labs in their department and institute
      filteredLabs = labs.filter(
        lab => lab.instituteId === user.instituteId && lab.department === user.department
      );
    } else {
      // Policy Maker with filters
      if (selectedInstitute !== "all") {
        filteredLabs = filteredLabs.filter(lab => lab.instituteId === selectedInstitute);
      }
      if (selectedDepartment !== "all") {
        filteredLabs = filteredLabs.filter(lab => lab.department === selectedDepartment);
      }
    }

    return filteredLabs;
  }, [labs, selectedInstitute, selectedDepartment, user]);

  const selectedLabData = useMemo(() => {
    if (selectedLab === "all") return null;
    return availableLabs.find(lab => lab.labId === selectedLab);
  }, [selectedLab, availableLabs]);

  // Fetch equipment when lab changes
  useEffect(() => {
    if (selectedLab !== "all") {
      fetchEquipment({ labId: selectedLab });
    }
  }, [selectedLab]);

  // Group equipment into rows for grid layout
  const equipmentGrid = useMemo(() => {
    if (!equipment.length) return [];
    
    const rows = [];
    for (let i = 0; i < equipment.length; i += gridColumns) {
      rows.push(equipment.slice(i, i + gridColumns));
    }
    return rows;
  }, [equipment, gridColumns]);

  const handleInstituteChange = (e) => {
    setSelectedInstitute(e.target.value);
    setSelectedDepartment("all");
    setSelectedLab("all");
  };

  const handleDepartmentChange = (e) => {
    setSelectedDepartment(e.target.value);
    setSelectedLab("all");
  };

  const handleLabChange = (e) => {
    setSelectedLab(e.target.value);
  };

  const isLoading = labsLoading || equipmentLoading || institutesLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Single Line Diagram (SLD)
        </h1>
        <p className="text-gray-600 mt-1">
          Visual representation of equipment layout and status in labs
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Select Lab</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Institute Filter (Only for Policy Maker) */}
          {user.role === "POLICY_MAKER" && (
            <select
              value={selectedInstitute}
              onChange={handleInstituteChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="all">All Institutes</option>
              {availableInstitutes.map((inst) => (
                <option key={inst.id} value={inst.instituteId}>
                  {inst.name}
                </option>
              ))}
            </select>
          )}

          {/* Department Filter (Only for Policy Maker) */}
          {user.role === "POLICY_MAKER" && (
            <select
              value={selectedDepartment}
              onChange={handleDepartmentChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading || availableDepartments.length === 0}
            >
              <option value="all">All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {DEPARTMENT_DISPLAY_NAMES[dept] || dept}
                </option>
              ))}
            </select>
          )}

          {/* Lab Filter */}
          <select
            value={selectedLab}
            onChange={handleLabChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading || availableLabs.length === 0}
          >
            <option value="all">Select a Lab</option>
            {availableLabs.map((lab) => (
              <option key={lab.labId} value={lab.labId}>
                {lab.name} ({lab.labId})
              </option>
            ))}
          </select>

          {/* Grid Columns Control */}
          <select
            value={gridColumns}
            onChange={(e) => setGridColumns(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={2}>2 Columns</option>
            <option value={3}>3 Columns</option>
            <option value={4}>4 Columns</option>
            <option value={5}>5 Columns</option>
          </select>
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">Status Legend</h3>
        <div className="flex flex-wrap gap-4">
          {Object.entries(STATUS_COLORS).map(([status, colorClass]) => (
            <div key={status} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${colorClass}`}></div>
              <span className="text-sm text-gray-700">
                {status.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* SLD Diagram */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-96">
            <LoadingSpinner size="lg" />
          </div>
        ) : selectedLab === "all" ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg">Please select a lab to view equipment layout</p>
          </div>
        ) : equipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <AlertCircle className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg">No equipment found in this lab</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Lab Header */}
            <div className="text-center border-b-4 border-blue-600 pb-4">
              <h2 className="text-3xl font-bold text-blue-900">
                {selectedLabData?.name || "Lab"}
              </h2>
              <p className="text-gray-600 mt-2">
                {selectedLabData?.institute?.name || ""} | {" "}
                {DEPARTMENT_DISPLAY_NAMES[selectedLabData?.department] || ""}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Total Equipment: {equipment.length}
              </p>
            </div>

            {/* Vertical Line from Header */}
            <div className="flex justify-center">
              <div className="w-1 h-16 bg-gray-400"></div>
            </div>

            {/* Equipment Grid */}
            <div className="space-y-12">
              {equipmentGrid.map((row, rowIndex) => (
                <div key={rowIndex}>
                  {/* Horizontal Line */}
                  <div className="flex justify-center mb-6">
                    <div className="w-full h-1 bg-gray-400"></div>
                  </div>

                  {/* Equipment Row */}
                  <div 
                    className="grid gap-8"
                    style={{ 
                      gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` 
                    }}
                  >
                    {row.map((eq) => (
                      <div key={eq.id} className="flex flex-col items-center">
                        {/* Vertical Line to Equipment */}
                        <div className="w-1 h-12 bg-gray-400 mb-4"></div>
                        
                        {/* Equipment Node */}
                        <EquipmentNode equipment={eq} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}