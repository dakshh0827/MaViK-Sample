/**
 * User Roles Enum
 * Matches the Prisma schema.
 */
export const USER_ROLE_ENUM = {
  POLICY_MAKER: 'POLICY_MAKER',
  LAB_TECHNICIAN: 'LAB_TECHNICIAN',
  TRAINER: 'TRAINER',
};

/**
 * User Roles as an Array
 * Useful for validation.
 */
export const USER_ROLES = Object.values(USER_ROLE_ENUM);

// --- NEWLY ADDED ---

/**
 * Auth Provider Enum
 * Matches the Prisma schema.
 */
export const AUTH_PROVIDER_ENUM = {
  CREDENTIAL: 'CREDENTIAL',
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
};

/**
 * OTP Purpose Enum
 * Matches the Prisma schema.
 */
export const OTP_PURPOSE_ENUM = {
  REGISTRATION: 'REGISTRATION',
  LOGIN: 'LOGIN',
};

// --- END NEWLY ADDED ---

/**
 * Alert Types Enum
 * Matches the Prisma schema.
 */
export const ALERT_TYPE = {
  FAULT_DETECTED: 'FAULT_DETECTED',
  HIGH_TEMPERATURE: 'HIGH_TEMPERATURE',
  ABNORMAL_VIBRATION: 'ABNORMAL_VIBRATION',
  HIGH_ENERGY_CONSUMPTION: 'HIGH_ENERGY_CONSUMPTION',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  WARRANTY_EXPIRING: 'WARRANTY_EXPIRING',
  UNSAFE_USAGE: 'UNSAFE_USAGE',
  EQUIPMENT_OFFLINE: 'EQUIPMENT_OFFLINE',
  LOW_HEALTH_SCORE: 'LOW_HEALTH_SCORE',
  CUSTOM: 'CUSTOM',
};

/**
 * Alert Severity Enum
 * Matches the Prisma schema.
 */
export const ALERT_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/**
 * Notification Types Enum
 * Matches the Prisma schema.
 */
export const NOTIFICATION_TYPE = {
  ALERT: 'ALERT',
  MAINTENANCE: 'MAINTENANCE',
  REPORT: 'REPORT',
  SYSTEM: 'SYSTEM',
  CHAT: 'CHAT',
};

/**
 * Maps Department enum to its specific category and name fields in the schema.
 */
export const DEPARTMENT_FIELD_MAP = {
  MECHANICAL_ENGINEERING: { cat: 'machineCategoryMechanical', name: 'equipmentNameMechanical' },
  FITTER_MANUFACTURING: { cat: 'machineCategoryFitter', name: 'equipmentNameFitter' },
  ELECTRICAL_ENGINEERING: { cat: 'machineCategoryElectrical', name: 'equipmentNameElectrical' },
  ELECTRONICS_COMMUNICATION: { cat: 'machineCategoryElectronics', name: 'equipmentNameElectronics' },
  AUTOMOTIVE_MECHANIC: { cat: 'machineCategoryAutomotive', name: 'equipmentNameAutomotive' },
  WELDING_FABRICATION: { cat: 'machineCategoryWelding', name: 'equipmentNameWelding' },
  REFRIGERATION_AC: { cat: 'machineCategoryRefrigerationAC', name: 'equipmentNameRefrigerationAC' },
  CARPENTRY_WOODWORKING: { cat: 'machineCategoryCarpentry', name: 'equipmentNameCarpentry' },
  PLUMBING: { cat: 'machineCategoryPlumbing', name: 'equipmentNamePlumbing' },
  ADVANCED_MANUFACTURING_CNC: { cat: 'machineCategoryAdvancedManufacturing', name: 'equipmentNameAdvancedManufacturing' },
  TOOL_DIE_MAKING: { cat: 'machineCategoryToolDieMaking', name: 'equipmentNameToolDieMaking' },
  ADDITIVE_MANUFACTURING: { cat: 'machineCategoryAdditiveManufacturing', name: 'equipmentNameAdditiveManufacturing' },
  SOLAR_INSTALLER_PV: { cat: 'machineCategorySolarInstaller', name: 'equipmentNameSolarInstaller' },
  HOSPITALITY_KITCHEN: { cat: 'machineCategoryHospitalityKitchen', name: 'equipmentNameHospitalityKitchen' },
  HOSPITALITY_FRONT_OFFICE: { cat: 'machineCategoryHospitalityFrontOffice', name: 'equipmentNameHospitalityFrontOffice' },
  HOSPITALITY_HOUSEKEEPING: { cat: 'machineCategoryHospitalityHousekeeping', name: 'equipmentNameHospitalityHousekeeping' },
  SECURITY_SERVICES: { cat: 'machineCategorySecurityServices', name: 'equipmentNameSecurityServices' },
  IT_COMPUTER_LAB: { cat: 'machineCategoryITComputerLab', name: 'equipmentNameITComputerLab' },
  TEXTILE_SEWING: { cat: 'machineCategoryTextileSewing', name: 'equipmentNameTextileSewing' },
  MATERIAL_TESTING_QUALITY: { cat: 'machineCategoryMaterialTestingQuality', name: 'equipmentNameMaterialTestingQuality' },
  // OTHER: { cat: 'machineCategoryOther', name: 'equipmentNameOther' }, // Add to schema if needed
};