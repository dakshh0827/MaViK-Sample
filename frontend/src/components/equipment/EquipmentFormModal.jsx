import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import LoadingSpinner from "../common/LoadingSpinner";

// Department to equipment name mapping
const DEPARTMENT_EQUIPMENT_NAMES = {
  FITTER_MANUFACTURING: [
    { value: "BENCH_DRILLING_MACHINE", label: "Bench Drilling Machine" },
    { value: "ANGLE_GRINDER_PORTABLE", label: "Angle Grinder (Portable)" },
    { value: "MANUAL_ARC_WELDING_MACHINE", label: "Manual Arc Welding Machine" },
    { value: "GAS_WELDING_KIT", label: "Gas Welding Kit" },
    { value: "MIG_CO2_WELDING_MACHINE", label: "MIG/CO2 Welding Machine" },
  ],
  ELECTRICAL_ENGINEERING: [
    { value: "ELECTRICIAN_TRAINING_PANEL", label: "Electrician Training Panel" },
    { value: "ADVANCED_ELECTRICIAN_SETUP_PLC_VFD", label: "Advanced Electrician Setup (PLC/VFD)" },
    { value: "BENCH_DRILLING_MACHINE", label: "Bench Drilling Machine" },
  ],
  WELDING_FABRICATION: [
    { value: "ARC_WELDING_MACHINE_200_300A", label: "Arc Welding Machine (200-300A)" },
    { value: "GAS_WELDING_KIT_OXY_ACETYLENE", label: "Gas Welding Kit (Oxy-Acetylene)" },
    { value: "MIG_CO2_WELDING_MACHINE_250_400A", label: "MIG/CO2 Welding Machine (250-400A)" },
    { value: "VR_AR_WELDING_SIMULATOR", label: "VR/AR Welding Simulator" },
  ],
  TOOL_DIE_MAKING: [
    { value: "TOOL_DIE_EQUIPMENT_EDM_JIG_BORING", label: "Tool & Die Equipment (EDM/Jig Boring)" },
    { value: "PLANER_MACHINE", label: "Planer Machine" },
    { value: "GEAR_HOBBING_SHAPING_MACHINE", label: "Gear Hobbing/Shaping Machine" },
  ],
  ADDITIVE_MANUFACTURING: [
    { value: "THREE_D_PRINTER_FDM_RESIN", label: "3D Printer (FDM/Resin)" },
    { value: "LASER_ENGRAVING_CUTTING_MACHINE", label: "Laser Engraving/Cutting Machine" },
  ],
  SOLAR_INSTALLER_PV: [
    { value: "INVERTER_TRAINING_UNIT", label: "Inverter Training Unit" },
    { value: "DRILLING_MACHINE_AND_TOOLS", label: "Drilling Machine and Tools" },
  ],
  MATERIAL_TESTING_QUALITY: [
    { value: "TENSILE_TESTING_MACHINE", label: "Tensile Testing Machine" },
    { value: "COMPRESSION_TESTING_MACHINE", label: "Compression Testing Machine" },
    { value: "IMPACT_TESTING_MACHINE_CHARPY_IZOD", label: "Impact Testing Machine (Charpy/Izod)" },
    { value: "HARDNESS_TESTER_ROCKWELL_BRINELL_VICKERS", label: "Hardness Tester (Rockwell/Brinell/Vickers)" },
    { value: "OPTICAL_COMPARATOR", label: "Optical Comparator" },
    { value: "ENVIRONMENTAL_CHAMBER", label: "Environmental Chamber" },
  ],
  ADVANCED_MANUFACTURING_CNC: [
    { value: "CNC_VERTICAL_MACHINING_CENTER_3_4_AXIS", label: "CNC Vertical Machining Center (3/4 Axis)" },
    { value: "CNC_LATHE_2_AXIS", label: "CNC Lathe (2 Axis)" },
  ],
  AUTOMOTIVE_MECHANIC: [
    { value: "MOTOR_VEHICLE_TRAINING_MODEL", label: "Motor Vehicle Training Model" },
  ],
};

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

export default function EquipmentFormModal({
  isOpen,
  onClose,
  onSubmit,
  equipment = null,
  userDepartment,
  userInstitute,
  userRole,
}) {
  const isEditing = !!equipment;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [availableLabs, setAvailableLabs] = useState([]);

  // For LAB_MANAGER, department is ALWAYS their department (hidden field)
  // For POLICY_MAKER, they can select any department
  const isPolicyMaker = userRole === "POLICY_MAKER";
  const isLabManager = userRole === "LAB_MANAGER";

  const [formData, setFormData] = useState({
    equipmentId: "",
    name: "",
    department: userDepartment || "", // Always use userDepartment initially
    equipmentName: "",
    labId: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    purchaseDate: "",
    warrantyExpiry: "",
    specifications: "",
    imageUrl: "",
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (equipment) {
      const departmentField = getDepartmentFieldName(equipment.department);
      const equipmentName = equipment[departmentField] || "";

      setFormData({
        equipmentId: equipment.equipmentId || "",
        name: equipment.name || "",
        department: equipment.department || userDepartment || "",
        equipmentName: equipmentName,
        labId: equipment.lab?.labId || "",
        manufacturer: equipment.manufacturer || "",
        model: equipment.model || "",
        serialNumber: equipment.serialNumber || "",
        purchaseDate: equipment.purchaseDate 
          ? new Date(equipment.purchaseDate).toISOString().split("T")[0]
          : "",
        warrantyExpiry: equipment.warrantyExpiry
          ? new Date(equipment.warrantyExpiry).toISOString().split("T")[0]
          : "",
        specifications: equipment.specifications 
          ? JSON.stringify(equipment.specifications, null, 2)
          : "",
        imageUrl: equipment.imageUrl || "",
      });
    } else {
      // For new equipment, always set department to userDepartment for Lab Managers
      setFormData(prev => ({
        ...prev,
        department: userDepartment || "",
      }));
    }
  }, [equipment, userDepartment]);

  useEffect(() => {
    if (userInstitute && formData.department) {
      fetchLabs();
    }
  }, [userInstitute, formData.department]);

  const getDepartmentFieldName = (department) => {
    const fieldMap = {
      FITTER_MANUFACTURING: 'fitterEquipmentName',
      ELECTRICAL_ENGINEERING: 'electricalEquipmentName',
      WELDING_FABRICATION: 'weldingEquipmentName',
      TOOL_DIE_MAKING: 'toolDieEquipmentName',
      ADDITIVE_MANUFACTURING: 'additiveManufacturingEquipmentName',
      SOLAR_INSTALLER_PV: 'solarInstallerEquipmentName',
      MATERIAL_TESTING_QUALITY: 'materialTestingEquipmentName',
      ADVANCED_MANUFACTURING_CNC: 'advancedManufacturingEquipmentName',
      AUTOMOTIVE_MECHANIC: 'automotiveEquipmentName',
    };
    return fieldMap[department] || '';
  };

  const fetchLabs = async () => {
    try {
      // Use formData.department instead of userDepartment for Policy Makers
      const department = isLabManager ? userDepartment : formData.department;
      
      const response = await fetch(
        `/api/labs?institute=${userInstitute}&department=${department}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAvailableLabs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch labs:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // If department changes and user is Policy Maker, refetch labs
    if (name === "department" && isPolicyMaker) {
      setFormData(prev => ({ ...prev, labId: "" })); // Reset lab selection
    }
    
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate required fields
      const requiredFields = [
        "equipmentId",
        "name",
        "department",
        "labId",
        "manufacturer",
        "model",
        "purchaseDate",
      ];

      for (const field of requiredFields) {
        if (!formData[field]) {
          throw new Error(`${field} is required`);
        }
      }

      // Parse specifications if provided
      let specifications = null;
      if (formData.specifications) {
        try {
          specifications = JSON.parse(formData.specifications);
        } catch (err) {
          throw new Error("Invalid JSON in specifications field");
        }
      }

      const submitData = {
        ...formData,
        specifications,
        serialNumber: formData.serialNumber || undefined,
        warrantyExpiry: formData.warrantyExpiry || undefined,
        imageUrl: formData.imageUrl || undefined,
        equipmentName: formData.equipmentName || undefined,
      };

      if (isEditing) {
        await onSubmit(equipment.id, submitData);
      } else {
        await onSubmit(submitData);
      }
    } catch (err) {
      setError(err.message || "Failed to save equipment");
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const availableEquipmentNames = DEPARTMENT_EQUIPMENT_NAMES[formData.department] || [];

  // Use React Portal to render modal at body level
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? "Edit Equipment" : "Add New Equipment"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Equipment ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="equipmentId"
              value={formData.equipmentId}
              onChange={handleChange}
              disabled={isEditing}
              placeholder="e.g., EQ-EE-001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Unique identifier for this equipment
            </p>
          </div>

          {/* Equipment Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., CNC Machine Model X"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Department - Only show for Policy Makers */}
          {isPolicyMaker && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                disabled={isEditing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                required
              >
                <option value="">Select Department</option>
                {Object.entries(DEPARTMENT_DISPLAY_NAMES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Hidden department field for Lab Managers */}
          {isLabManager && (
            <input 
              type="hidden" 
              name="department" 
              value={formData.department} 
            />
          )}

          {/* Show department info for Lab Managers (read-only display) */}
          {isLabManager && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Department:</span> {DEPARTMENT_DISPLAY_NAMES[formData.department] || formData.department}
              </p>
            </div>
          )}

          {/* Equipment Type (Department-specific) */}
          {availableEquipmentNames.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Equipment Type
              </label>
              <select
                name="equipmentName"
                value={formData.equipmentName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Type (Optional)</option>
                {availableEquipmentNames.map((eq) => (
                  <option key={eq.value} value={eq.value}>
                    {eq.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Lab */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lab <span className="text-red-500">*</span>
            </label>
            <select
              name="labId"
              value={formData.labId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select Lab</option>
              {availableLabs.map((lab) => (
                <option key={lab.labId} value={lab.labId}>
                  {lab.name} ({lab.labId})
                </option>
              ))}
            </select>
          </div>

          {/* Manufacturer & Model */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Manufacturer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                placeholder="e.g., Siemens"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                placeholder="e.g., S7-1200"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Serial Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number
            </label>
            <input
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              placeholder="e.g., SN123456789"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warranty Expiry
              </label>
              <input
                type="date"
                name="warrantyExpiry"
                value={formData.warrantyExpiry}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Specifications (JSON) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specifications (JSON)
            </label>
            <textarea
              name="specifications"
              value={formData.specifications}
              onChange={handleChange}
              rows={4}
              placeholder='{"power": "5kW", "voltage": "380V"}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter specifications in JSON format
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading && <LoadingSpinner size="sm" />}
              {isEditing ? "Update Equipment" : "Add Equipment"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
