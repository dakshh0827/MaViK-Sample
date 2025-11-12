import { body, oneOf, validationResult } from 'express-validator';
import { USER_ROLE_ENUM, OTP_PURPOSE_ENUM } from '../utils/constants.js';

/**
 * Middleware to handle validation errors from express-validator.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// --- Auth Validation ---

export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail() // Added from your version
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/) // Added from your version
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('role')
    .optional()
    .isIn(Object.values(USER_ROLE_ENUM)) // --- FIX: Using correct project enums
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone() // Added from your version
    .withMessage('Please provide a valid phone number'),
  // --- FIX: Added conditional institute/labId checks
  body('institute')
    .if(body('role').equals(USER_ROLE_ENUM.LAB_TECHNICIAN))
    .notEmpty()
    .withMessage('Institute is required for Lab Technicians'),
  body('labId')
    .if(body('role').equals(USER_ROLE_ENUM.TRAINER))
    .notEmpty()
    .isString()
    .withMessage('A valid Lab ID (public string) is required for Trainers'),
  handleValidationErrors,
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

export const verifyOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('purpose')
    .optional()
    .isIn(Object.values(OTP_PURPOSE_ENUM))
    .withMessage('A valid OTP purpose is required'),
  handleValidationErrors,
];


export const resendOTPValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('purpose')
    .optional()
    .isIn(Object.values(OTP_PURPOSE_ENUM))
    .withMessage('A valid OTP purpose is required'),
  handleValidationErrors,
];


export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/) // Added from your version
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  handleValidationErrors,
];

// --- User Validation ---

export const createUserValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('role')
    .isIn(Object.values(USER_ROLE_ENUM)) // --- FIX: Using correct project enums
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  // --- FIX: Added conditional institute/labId checks
  body('institute')
    .if(body('role').equals(USER_ROLE_ENUM.LAB_TECHNICIAN))
    .notEmpty()
    .withMessage('Institute is required for Lab Technicians'),
  body('labId')
    .if(body('role').equals(USER_ROLE_ENUM.TRAINER))
    .notEmpty()
    .isString()
    .withMessage('A valid Lab ID (public string) is required for Trainers'),
  handleValidationErrors,
];

export const updateUserValidation = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('First name must be at least 2 characters long'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Last name must be at least 2 characters long'),
  body('role')
    .optional()
    .isIn(Object.values(USER_ROLE_ENUM)) // --- FIX: Using correct project enums
    .withMessage('Invalid role'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  // --- FIX: Added conditional institute/labId checks
  body('institute')
    .if(body('role').equals(USER_ROLE_ENUM.LAB_TECHNICIAN))
    .notEmpty()
    .withMessage('Institute is required for Lab Technicians'),
  body('labId')
    .if(body('role').equals(USER_ROLE_ENUM.TRAINER))
    .notEmpty()
    .isString()
    .withMessage('A valid Lab ID (public string) is required for Trainers'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors,
];

// --- Equipment Validation ---

export const equipmentValidation = [
  body('equipmentId').notEmpty().withMessage('Equipment ID is required'),
  body('name').notEmpty().withMessage('Equipment name is required'),
  body('department').notEmpty().withMessage('Department is required'),
  body('labId').notEmpty().isString().withMessage('A valid Lab ID (public string) is required'),
  body('manufacturer').notEmpty().withMessage('Manufacturer is required'),
  body('model').notEmpty().withMessage('Model is required'),
  body('purchaseDate').isISO8601().withMessage('Valid purchase date is required'),
  body('warrantyExpiry').optional().isISO8601().withMessage('Valid warranty date is required'),
  body('specifications').optional().isObject().withMessage('Specifications must be an object'),
  handleValidationErrors,
];

// --- Maintenance Validation ---

export const maintenanceLogValidation = [
  body('equipmentId').notEmpty().isMongoId().withMessage('A valid Equipment ID is required'),
  body('type').notEmpty().withMessage('Maintenance type is required'),
  body('status').notEmpty().withMessage('Maintenance status is required'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('cost').optional().isFloat({ min: 0 }).withMessage('Cost must be a positive number'),
  handleValidationErrors,
];

// --- Report Validation ---
// --- FIX: Replaced custom functions with express-validator ---
export const reportValidation = [
  body('reportType').notEmpty().withMessage('Report type is required'),
  body('dateFrom').isISO8601().withMessage('Valid start date is required'),
  body('dateTo').isISO8601().withMessage('Valid end date is required'),
  handleValidationErrors,
];

// --- Chatbot Validation ---

export const chatbotValidation = [
  body('message').notEmpty().withMessage('Message cannot be empty'),
  handleValidationErrors,
];

// --- Lab Validation ---

export const labValidation = [
  body('labId').notEmpty().isString().withMessage('Lab ID is required (e.g., "ITI-PUSA-MECH-01")'),
  body('name').notEmpty().withMessage('Lab name is required'),
  body('institute').notEmpty().withMessage('Institute name is required'),
  handleValidationErrors,
];


// Add these validation functions to your existing validation.js middleware

export const dailyReportValidation = (req, res, next) => {
  const { date } = req.body;
  
  if (date && isNaN(Date.parse(date))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Please provide a valid date.',
    });
  }
  
  next();
};

export const weeklyReportValidation = (req, res, next) => {
  const { weekStart } = req.body;
  
  if (weekStart && isNaN(Date.parse(weekStart))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid weekStart date format. Please provide a valid date.',
    });
  }
  
  next();
};

export const monthlyReportValidation = (req, res, next) => {
  const { year, month } = req.body;
  
  if (year && (isNaN(year) || year < 2000 || year > 2100)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid year. Please provide a year between 2000 and 2100.',
    });
  }
  
  if (month !== undefined && (isNaN(month) || month < 0 || month > 11)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid month. Please provide a month between 0 (January) and 11 (December).',
    });
  }
  
  next();
};