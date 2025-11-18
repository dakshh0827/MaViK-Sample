/*
 * =====================================================
 * backend/jobs/breakdown.scheduler.js
 * =====================================================
 */
import cron from "node-cron";
import breakdownController from "../controllers/breakdown.controller.js";
import logger from "../utils/logger.js";

/**
 * Schedule breakdown check to run daily at 9:00 AM
 * Cron format: minute hour day month weekday
 */
export const scheduleBreakdownCheck = () => {
  // Run every day at 9:00 AM
  cron.schedule("0 9 * * *", async () => {
    logger.info("⏰ Running scheduled breakdown check...");
    try {
      await breakdownController.checkInactiveEquipment();
      logger.info("✅ Breakdown check completed successfully");
    } catch (error) {
      logger.error("❌ Error in scheduled breakdown check:", error);
    }
  });

  logger.info(
    "📅 Breakdown check scheduler initialized (runs daily at 9:00 AM)"
  );
};

/**
 * Run breakdown check manually (for testing)
 */
export const runBreakdownCheckNow = async () => {
  logger.info("🔧 Running manual breakdown check...");
  try {
    const result = await breakdownController.checkInactiveEquipment();
    logger.info("✅ Manual breakdown check completed");
    return result;
  } catch (error) {
    logger.error("❌ Error in manual breakdown check:", error);
    throw error;
  }
};
