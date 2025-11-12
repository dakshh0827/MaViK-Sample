import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '../reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

class PDFReportGenerator {
  constructor() {
    this.colors = {
      primary: '#2563eb',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      gray: '#6b7280',
      lightGray: '#f3f4f6',
    };
  }

  // Create a new PDF document
  createDocument() {
    return new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });
  }

  // Add header to the page
  addHeader(doc, title, subtitle) {
    doc
      .fillColor(this.colors.primary)
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(title, { align: 'center' })
      .moveDown(0.3);

    if (subtitle) {
      doc
        .fillColor(this.colors.gray)
        .fontSize(12)
        .font('Helvetica')
        .text(subtitle, { align: 'center' })
        .moveDown(1);
    }

    doc
      .strokeColor(this.colors.primary)
      .lineWidth(2)
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
      .moveDown(1);
  }

  // Add footer to the page
  addFooter(doc, pageNumber, totalPages) {
    doc
      .fontSize(10)
      .fillColor(this.colors.gray)
      .text(
        `Page ${pageNumber} of ${totalPages} | Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
  }

  // Add section title
  addSectionTitle(doc, title) {
    doc
      .fillColor(this.colors.primary)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(title)
      .moveDown(0.5);
  }

  // Add key-value pair
  addKeyValue(doc, key, value, options = {}) {
    const { color = 'black', bold = false } = options;
    
    doc
      .fillColor(this.colors.gray)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(key + ': ', { continued: true })
      .fillColor(color)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .text(value || 'N/A')
      .moveDown(0.3);
  }

  // Add table
  addTable(doc, headers, rows, columnWidths) {
    const startY = doc.y;
    const rowHeight = 25;
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    let currentY = startY;

    // Draw header
    doc
      .fillColor(this.colors.primary)
      .rect(50, currentY, tableWidth, rowHeight)
      .fill();

    doc.fillColor('white').fontSize(10).font('Helvetica-Bold');
    let currentX = 50;
    headers.forEach((header, i) => {
      doc.text(header, currentX + 5, currentY + 7, {
        width: columnWidths[i] - 10,
        align: 'left',
      });
      currentX += columnWidths[i];
    });

    currentY += rowHeight;

    // Draw rows
    rows.forEach((row, rowIndex) => {
      const fillColor = rowIndex % 2 === 0 ? 'white' : this.colors.lightGray;
      doc
        .fillColor(fillColor)
        .rect(50, currentY, tableWidth, rowHeight)
        .fill();

      doc.fillColor('black').fontSize(9).font('Helvetica');
      currentX = 50;
      row.forEach((cell, cellIndex) => {
        doc.text(String(cell || ''), currentX + 5, currentY + 7, {
          width: columnWidths[cellIndex] - 10,
          align: 'left',
        });
        currentX += columnWidths[cellIndex];
      });

      currentY += rowHeight;

      // Check if we need a new page
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }
    });

    doc.y = currentY + 10;
  }

  // Add metrics cards
  addMetricsCards(doc, metrics) {
    const cardWidth = 120;
    const cardHeight = 70;
    const spacing = 15;
    let x = 50;
    let y = doc.y;

    metrics.forEach((metric, index) => {
      if (index > 0 && index % 4 === 0) {
        y += cardHeight + spacing;
        x = 50;
      }

      // Card background
      doc
        .fillColor(this.colors.lightGray)
        .rect(x, y, cardWidth, cardHeight)
        .fill();

      // Metric label
      doc
        .fillColor(this.colors.gray)
        .fontSize(9)
        .font('Helvetica')
        .text(metric.label, x + 10, y + 10, {
          width: cardWidth - 20,
          align: 'center',
        });

      // Metric value
      doc
        .fillColor(metric.color || this.colors.primary)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(metric.value, x + 10, y + 30, {
          width: cardWidth - 20,
          align: 'center',
        });

      // Metric unit
      if (metric.unit) {
        doc
          .fillColor(this.colors.gray)
          .fontSize(8)
          .font('Helvetica')
          .text(metric.unit, x + 10, y + 53, {
            width: cardWidth - 20,
            align: 'center',
          });
      }

      x += cardWidth + spacing;
    });

    doc.y = y + cardHeight + 20;
  }

  // Generate Daily Report PDF
  async generateDailyReport(data) {
    const doc = this.createDocument();
    const fileName = `daily-report-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header
    this.addHeader(
      doc,
      'Daily Equipment Report',
      `${data.period.start.toLocaleDateString()}`
    );

    // Summary Section
    this.addSectionTitle(doc, 'Daily Summary');
    
    const summaryMetrics = [
      { label: 'Total Equipment', value: data.summary.totalEquipment, color: this.colors.primary },
      { label: 'Avg Health Score', value: data.summary.avgHealthScore.toFixed(1), unit: '%', color: this.colors.success },
      { label: 'Total Alerts', value: data.summary.totalAlerts, color: this.colors.warning },
      { label: 'Critical Alerts', value: data.summary.criticalAlerts, color: this.colors.danger },
      { label: 'Total Downtime', value: data.summary.totalDowntime.toFixed(1), unit: 'hrs', color: this.colors.danger },
      { label: 'Energy Consumed', value: data.summary.totalEnergyConsumed.toFixed(1), unit: 'kWh', color: this.colors.primary },
      { label: 'Avg Utilization', value: data.summary.avgUtilization.toFixed(1), unit: '%', color: this.colors.success },
    ];

    this.addMetricsCards(doc, summaryMetrics);

    // Equipment Status Distribution
    this.addSectionTitle(doc, 'Equipment Status Distribution');
    Object.entries(data.summary.equipmentByStatus).forEach(([status, count]) => {
      this.addKeyValue(doc, status, count.toString());
    });
    doc.moveDown(1);

    // Top Equipment Details
    this.addSectionTitle(doc, 'Equipment Details (Top 10)');
    
    const topEquipment = data.equipmentDetails.slice(0, 10);
    topEquipment.forEach((eq, index) => {
      if (doc.y > 650) doc.addPage();

      doc
        .fillColor(this.colors.primary)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${index + 1}. ${eq.equipment.name} (${eq.equipment.equipmentId})`)
        .moveDown(0.3);

      this.addKeyValue(doc, 'Department', eq.equipment.department);
      this.addKeyValue(doc, 'Location', eq.equipment.location);
      this.addKeyValue(doc, 'Institute', eq.equipment.institute);
      this.addKeyValue(
        doc,
        'Health Score',
        eq.currentStatus ? `${eq.currentStatus.healthScore}%` : 'N/A',
        { color: eq.currentStatus?.healthScore > 70 ? this.colors.success : this.colors.danger }
      );
      this.addKeyValue(doc, 'Status', eq.currentStatus?.status || 'N/A');
      this.addKeyValue(doc, 'Usage Hours', `${eq.usageMetrics.totalUsageHours.toFixed(2)} hrs`);
      this.addKeyValue(doc, 'Downtime', `${eq.usageMetrics.totalDowntime.toFixed(2)} hrs`);
      this.addKeyValue(doc, 'Utilization', `${eq.usageMetrics.avgUtilization.toFixed(1)}%`);
      this.addKeyValue(doc, 'Alerts Today', eq.alertMetrics.totalAlerts.toString());

      doc.moveDown(0.5);
    });

    // Generated by
    doc.addPage();
    this.addSectionTitle(doc, 'Report Information');
    this.addKeyValue(doc, 'Generated By', data.generatedBy.name);
    this.addKeyValue(doc, 'Email', data.generatedBy.email);
    this.addKeyValue(doc, 'Generated At', data.generatedAt.toLocaleString());

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(`/reports/${fileName}`));
      stream.on('error', reject);
    });
  }

  // Generate Weekly Report PDF
  async generateWeeklyReport(data) {
    const doc = this.createDocument();
    const fileName = `weekly-report-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header
    this.addHeader(
      doc,
      'Weekly Equipment Report',
      `${data.period.start.toLocaleDateString()} - ${data.period.end.toLocaleDateString()}`
    );

    // Summary Section
    this.addSectionTitle(doc, 'Weekly Summary');
    
    const summaryMetrics = [
      { label: 'Total Equipment', value: data.summary.totalEquipment, color: this.colors.primary },
      { label: 'Avg Health Score', value: data.summary.avgHealthScore.toFixed(1), unit: '%', color: this.colors.success },
      { label: 'Total Alerts', value: data.summary.totalAlerts, color: this.colors.warning },
      { label: 'Maintenance Activities', value: data.summary.totalMaintenanceActivities, color: this.colors.primary },
      { label: 'Maintenance Cost', value: `$${data.summary.totalMaintenanceCost.toFixed(0)}`, color: this.colors.danger },
      { label: 'Energy Consumed', value: data.summary.totalEnergyConsumed.toFixed(1), unit: 'kWh', color: this.colors.primary },
      { label: 'Usage Hours', value: data.summary.totalUsageHours.toFixed(1), unit: 'hrs', color: this.colors.success },
      { label: 'Total Downtime', value: data.summary.totalDowntime.toFixed(1), unit: 'hrs', color: this.colors.danger },
    ];

    this.addMetricsCards(doc, summaryMetrics);

    // Equipment Performance Table
    this.addSectionTitle(doc, 'Equipment Performance Overview');
    
    const headers = ['Equipment', 'Health', 'Utilization', 'Alerts', 'Maintenance'];
    const columnWidths = [200, 70, 90, 70, 65];
    const rows = data.equipmentDetails.slice(0, 15).map(eq => [
      `${eq.equipment.name}`,
      `${eq.currentStatus?.healthScore || 0}%`,
      `${eq.usageMetrics.avgUtilization.toFixed(1)}%`,
      eq.alertMetrics.totalAlerts,
      eq.maintenanceMetrics.totalMaintenance,
    ]);

    this.addTable(doc, headers, rows, columnWidths);

    // Maintenance Summary
    doc.addPage();
    this.addSectionTitle(doc, 'Maintenance Summary');
    
    const maintenanceData = data.equipmentDetails.reduce((acc, eq) => {
      Object.entries(eq.maintenanceMetrics.maintenanceByType).forEach(([type, count]) => {
        acc[type] = (acc[type] || 0) + count;
      });
      return acc;
    }, {});

    Object.entries(maintenanceData).forEach(([type, count]) => {
      this.addKeyValue(doc, type, count.toString());
    });

    doc.moveDown(1);
    this.addKeyValue(doc, 'Total Maintenance Cost', `$${data.summary.totalMaintenanceCost.toFixed(2)}`, { bold: true });

    // Generated by
    doc.moveDown(2);
    this.addSectionTitle(doc, 'Report Information');
    this.addKeyValue(doc, 'Generated By', data.generatedBy.name);
    this.addKeyValue(doc, 'Email', data.generatedBy.email);
    this.addKeyValue(doc, 'Generated At', data.generatedAt.toLocaleString());

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(`/reports/${fileName}`));
      stream.on('error', reject);
    });
  }

  // Generate Monthly Report PDF
  async generateMonthlyReport(data) {
    const doc = this.createDocument();
    const fileName = `monthly-report-${new Date().toISOString().split('T')[0]}-${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, fileName);
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header
    this.addHeader(
      doc,
      'Monthly Equipment Report',
      data.period.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    );

    // Executive Summary
    this.addSectionTitle(doc, 'Executive Summary');
    
    const summaryMetrics = [
      { label: 'Total Equipment', value: data.summary.totalEquipment, color: this.colors.primary },
      { label: 'Avg Health Score', value: data.summary.avgHealthScore.toFixed(1), unit: '%', color: this.colors.success },
      { label: 'Total Alerts', value: data.summary.totalAlerts, color: this.colors.warning },
      { label: 'Maintenance Cost', value: `$${data.summary.totalMaintenanceCost.toFixed(0)}`, color: this.colors.danger },
      { label: 'Energy Consumed', value: data.summary.totalEnergyConsumed.toFixed(1), unit: 'kWh', color: this.colors.primary },
      { label: 'Avg Utilization', value: data.summary.avgUtilization.toFixed(1), unit: '%', color: this.colors.success },
      { label: 'Avg Efficiency', value: data.summary.avgEfficiency.toFixed(1), unit: '%', color: this.colors.success },
      { label: 'Total Downtime', value: data.summary.totalDowntime.toFixed(1), unit: 'hrs', color: this.colors.danger },
    ];

    this.addMetricsCards(doc, summaryMetrics);

    // Top Performing Equipment
    this.addSectionTitle(doc, 'Top 5 Performing Equipment');
    data.summary.topPerformingEquipment.forEach((eq, index) => {
      this.addKeyValue(
        doc,
        `${index + 1}. ${eq.name}`,
        `${eq.healthScore}%`,
        { color: this.colors.success }
      );
    });

    doc.moveDown(1);

    // Bottom Performing Equipment
    this.addSectionTitle(doc, 'Equipment Requiring Attention');
    data.summary.bottomPerformingEquipment.forEach((eq, index) => {
      this.addKeyValue(
        doc,
        `${index + 1}. ${eq.name}`,
        `${eq.healthScore}%`,
        { color: this.colors.danger }
      );
    });

    // Detailed Equipment Analysis
    doc.addPage();
    this.addSectionTitle(doc, 'Detailed Equipment Analysis');
    
    const headers = ['Equipment', 'Health', 'Utilization', 'Efficiency', 'Alerts', 'Maint.'];
    const columnWidths = [170, 60, 80, 70, 60, 55];
    const rows = data.equipmentDetails.slice(0, 20).map(eq => [
      eq.equipment.name.substring(0, 25),
      `${eq.currentStatus?.healthScore || 0}%`,
      `${eq.usageMetrics.avgUtilization.toFixed(1)}%`,
      `${eq.usageMetrics.avgEfficiency.toFixed(1)}%`,
      eq.alertMetrics.totalAlerts,
      eq.maintenanceMetrics.totalMaintenance,
    ]);

    this.addTable(doc, headers, rows, columnWidths);

    // Maintenance and Cost Analysis
    doc.addPage();
    this.addSectionTitle(doc, 'Maintenance & Cost Analysis');
    
    this.addKeyValue(doc, 'Total Maintenance Activities', data.summary.totalMaintenanceActivities.toString());
    this.addKeyValue(doc, 'Total Maintenance Cost', `$${data.summary.totalMaintenanceCost.toFixed(2)}`, { bold: true });
    this.addKeyValue(doc, 'Average Cost per Equipment', `$${(data.summary.totalMaintenanceCost / data.summary.totalEquipment).toFixed(2)}`);
    
    doc.moveDown(1);
    this.addSectionTitle(doc, 'Maintenance Breakdown by Type');
    
    const maintenanceData = data.equipmentDetails.reduce((acc, eq) => {
      Object.entries(eq.maintenanceMetrics.maintenanceByType).forEach(([type, count]) => {
        acc[type] = (acc[type] || 0) + count;
      });
      return acc;
    }, {});

    Object.entries(maintenanceData).forEach(([type, count]) => {
      this.addKeyValue(doc, type, count.toString());
    });

    // Energy Consumption Analysis
    doc.moveDown(2);
    this.addSectionTitle(doc, 'Energy Consumption Analysis');
    this.addKeyValue(doc, 'Total Energy Consumed', `${data.summary.totalEnergyConsumed.toFixed(2)} kWh`, { bold: true });
    this.addKeyValue(doc, 'Average per Equipment', `${(data.summary.totalEnergyConsumed / data.summary.totalEquipment).toFixed(2)} kWh`);

    // Recommendations
    doc.addPage();
    this.addSectionTitle(doc, 'Recommendations');
    
    const recommendations = [
      'Schedule preventive maintenance for equipment with health scores below 70%',
      'Investigate high energy consumers for potential efficiency improvements',
      'Review maintenance costs for equipment exceeding budget allocations',
      'Consider replacement or major overhaul for consistently underperforming equipment',
      'Implement predictive maintenance strategies to reduce emergency repairs',
    ];

    recommendations.forEach((rec, index) => {
      doc
        .fillColor('black')
        .fontSize(11)
        .font('Helvetica')
        .text(`${index + 1}. ${rec}`)
        .moveDown(0.5);
    });

    // Generated by
    doc.moveDown(2);
    this.addSectionTitle(doc, 'Report Information');
    this.addKeyValue(doc, 'Generated By', data.generatedBy.name);
    this.addKeyValue(doc, 'Email', data.generatedBy.email);
    this.addKeyValue(doc, 'Generated At', data.generatedAt.toLocaleString());

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(`/reports/${fileName}`));
      stream.on('error', reject);
    });
  }
}

const generator = new PDFReportGenerator();

export async function generatePDFReport(data, reportType) {
  try {
    switch (reportType) {
      case 'daily':
        return await generator.generateDailyReport(data);
      case 'weekly':
        return await generator.generateWeeklyReport(data);
      case 'monthly':
        return await generator.generateMonthlyReport(data);
      default:
        throw new Error('Unsupported report type');
    }
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
}