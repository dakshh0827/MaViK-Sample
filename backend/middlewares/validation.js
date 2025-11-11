import { body, validationResult } from 'express-validator';
import { USER_ROLES } from '../utils/constants.js';

/**
 * Middleware to handle validation errors from express-validator.
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// --- Auth Validations ---

export const registerValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role')
    .optional()
    .isIn(USER_ROLES)
    .withMessage('Invalid role'),
  body('institute').optional().isString(),
  handleValidationErrors,
];

export const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
  handleValidationErrors,
];

// --- User Management Validations ---

export const createUserValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role')
    .isIn(USER_ROLES)
    .withMessage('Invalid role'),
  body('institute').optional().isString(),
  handleValidationErrors,
];

export const updateUserValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role')
    .isIn(USER_ROLES)
    .withMessage('Invalid role'),
  body('institute').optional().isString(),
  handleValidationErrors,
];

// --- Maintenance Validations ---

export const maintenanceLogValidation = [
  body('equipmentId').isMongoId().withMessage('Valid equipment ID is required'),
  body('type').notEmpty().withMessage('Maintenance type is required'),
  body('status').notEmpty().withMessage('Maintenance status is required'),
  body('scheduledDate').isISO8601().withMessage('Valid scheduled date is required'),
  body('description').notEmpty().withMessage('Description is required'),
  handleValidationErrors,
];

// --- Report Validations ---

export const reportValidation = [
  body('reportType').notEmpty().withMessage('Report type is required'),
  body('dateFrom').isISO8601().withMessage('Valid start date is required'),
  body('dateTo').isISO8601().withMessage('Valid end date is required'),
  handleValidationErrors,
];

// --- Chatbot Validations ---
export const chatbotValidation = [
  body('message').notEmpty().withMessage('Message is required'),
  handleValidationErrors,
];