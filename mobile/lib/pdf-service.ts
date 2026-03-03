import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { GroupRecord } from './types';

export class PDFService {
  /**
   * Generate PDF for a group analysis
   */
  static async generateGroupPDF(
    group: GroupRecord,
    userName: string
  ): Promise<string> {
    const html = this.generateGroupHTML(group, userName);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Generate PDF for analytics
   */
  static async generateAnalyticsPDF(
    analytics: any,
    userName: string,
    dateRange: { from: string; to: string }
  ): Promise<string> {
    const html = this.generateAnalyticsHTML(analytics, userName, dateRange);
    
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    return uri;
  }

  /**
   * Share PDF file
   */
  static async sharePDF(uri: string, fileName: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Copy to a permanent location with proper filename
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: newUri });

    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share PDF Report',
      UTI: 'com.adobe.pdf',
    });
  }

  /**
   * Generate HTML for group report
   */
  private static generateGroupHTML(group: GroupRecord, userName: string): string {
    const analysis = group.analysisResult;
    if (!analysis) {
      throw new Error('No analysis result available');
    }

    const stats = analysis.aggregateStats;
    const date = new Date(group.createdAt).toLocaleDateString();
    const time = new Date(group.createdAt).toLocaleTimeString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Catch Report - ${date}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 40px;
              color: #1e293b;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #1e40af;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #1e40af;
              margin: 0;
              font-size: 32px;
            }
            .header p {
              color: #64748b;
              margin: 5px 0;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f1f5f9;
              padding: 20px;
              border-radius: 12px;
              border-left: 4px solid #1e40af;
            }
            .stat-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 28px;
              font-weight: bold;
              color: #1e293b;
            }
            .section {
              margin: 30px 0;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 15px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 10px;
            }
            .species-list {
              list-style: none;
              padding: 0;
            }
            .species-item {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              background: #f8fafc;
              margin-bottom: 8px;
              border-radius: 8px;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🐟 Catch Report</h1>
            <p><strong>${userName}</strong></p>
            <p>${date} at ${time}</p>
            <p>Group ID: ${group.groupId.substring(0, 8)}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Fish</div>
              <div class="stat-value">${stats.totalFishCount}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Species Count</div>
              <div class="stat-value">${Object.keys(stats.speciesDistribution).length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Estimated Weight</div>
              <div class="stat-value">${stats.totalEstimatedWeight.toFixed(1)} kg</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Estimated Value</div>
              <div class="stat-value">₹${stats.totalEstimatedValue.toFixed(0)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Species Distribution</div>
            <ul class="species-list">
              ${Object.entries(stats.speciesDistribution)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(
                  ([species, count]) => `
                <li class="species-item">
                  <span>${species}</span>
                  <strong>${count} fish</strong>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>

          ${
            group.latitude && group.longitude
              ? `
          <div class="section">
            <div class="section-title">Location</div>
            <p>Latitude: ${group.latitude.toFixed(6)}</p>
            <p>Longitude: ${group.longitude.toFixed(6)}</p>
          </div>
          `
              : ''
          }

          <div class="footer">
            <p>Generated by OceanAI - AI for Bharat Fishermen</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for analytics report
   */
  private static generateAnalyticsHTML(
    analytics: any,
    userName: string,
    dateRange: { from: string; to: string }
  ): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Analytics Report</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              padding: 40px;
              color: #1e293b;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #1e40af;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #1e40af;
              margin: 0;
              font-size: 32px;
            }
            .header p {
              color: #64748b;
              margin: 5px 0;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin: 30px 0;
            }
            .stat-card {
              background: #f1f5f9;
              padding: 20px;
              border-radius: 12px;
              border-left: 4px solid #1e40af;
            }
            .stat-label {
              font-size: 12px;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 5px;
            }
            .stat-value {
              font-size: 28px;
              font-weight: bold;
              color: #1e293b;
            }
            .footer {
              margin-top: 50px;
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Analytics Report</h1>
            <p><strong>${userName}</strong></p>
            <p>${dateRange.from} to ${dateRange.to}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Catches</div>
              <div class="stat-value">${analytics.totalCatches || 0}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Earnings</div>
              <div class="stat-value">₹${analytics.totalEarnings || 0}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Average Weight</div>
              <div class="stat-value">${analytics.avgWeight || 0} kg</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Top Species</div>
              <div class="stat-value">${analytics.topSpecies || 'N/A'}</div>
            </div>
          </div>

          <div class="footer">
            <p>Generated by OceanAI - AI for Bharat Fishermen</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
  }
}
