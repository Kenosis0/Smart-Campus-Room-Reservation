const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const requireRoles = require('../middleware/requireRoles');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

router.use(requireAuth);

/**
 * Generate room utilization report
 * Only System Admin can generate full reports
 * Other roles can only view summaries
 */
router.get(
  '/utilization',
  asyncHandler(async (req, res) => {
    const reportType = req.query.type || 'summary';

    // Regular users can only request summary reports
    if (req.user.roleCode !== 'SYSTEM_ADMIN' && reportType !== 'summary') {
      return sendError(res, 403, 'Only System Admin can generate full reports. Use ?type=summary for basic statistics.');
    }

    try {
      const reportData = await generatePythonReport(reportType);
      sendSuccess(res, reportData);
    } catch (error) {
      console.error('Report generation error:', error);
      sendError(res, 500, 'Failed to generate report', { error: error.message });
    }
  })
);

/**
 * Generate summary report (accessible to all authenticated users)
 */
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    try {
      const reportData = await generatePythonReport('summary');
      sendSuccess(res, reportData);
    } catch (error) {
      console.error('Report generation error:', error);
      sendError(res, 500, 'Failed to generate report', { error: error.message });
    }
  })
);

/**
 * Generate full report (System Admin only)
 */
router.get(
  '/full',
  requireRoles(['SYSTEM_ADMIN']),
  asyncHandler(async (req, res) => {
    try {
      const reportData = await generatePythonReport('full');
      sendSuccess(res, reportData);
    } catch (error) {
      console.error('Report generation error:', error);
      sendError(res, 500, 'Failed to generate report', { error: error.message });
    }
  })
);

/**
 * Helper function to spawn Python process and get report
 */
function generatePythonReport(reportType) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../../scripts/generate_report.py');
    const pythonProcess = spawn('python', [scriptPath, reportType]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start report generator: ${error.message}`));
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        reject(new Error(`Report generation failed: ${stderr}`));
        return;
      }

      try {
        const report = JSON.parse(stdout);
        resolve(report);
      } catch (error) {
        console.error('Failed to parse report JSON:', stdout);
        reject(new Error(`Invalid report format: ${error.message}`));
      }
    });
  });
}

module.exports = router;
