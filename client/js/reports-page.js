(function initReportsPage() {
  const state = {
    currentReport: null,
    loading: false
  };

  const elements = {
    reportType: document.getElementById('reportType'),
    generateReportBtn: document.getElementById('generateReportBtn'),
    downloadReportBtn: document.getElementById('downloadReportBtn'),
    notice: document.getElementById('pageNotice'),
    reportContainer: document.getElementById('reportContainer')
  };

  function setNotice(text, type = 'info') {
    window.UIComponents.setNotice(elements.notice, text, type);
  }

  function disableControls() {
    elements.generateReportBtn.disabled = true;
    elements.reportType.disabled = true;
    state.loading = true;
  }

  function enableControls() {
    elements.generateReportBtn.disabled = false;
    elements.reportType.disabled = false;
    state.loading = false;
  }

  function formatNumber(num) {
    return Number(num).toLocaleString();
  }

  function formatDuration(hours) {
    if (!hours) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function renderSummaryReport(report) {
    const { totals, top_room, peak_time } = report;
    
    if (!totals) {
      return '<p class="text-slate-500">No data available</p>';
    }

    let html = `
      <section class="grid gap-6 md:grid-cols-5">
        <div class="rounded-lg bg-white border border-slate-200 p-5 hover:border-slate-300 transition-colors">
          <p class="text-sm text-slate-600 font-medium">Total Rooms</p>
          <p class="text-3xl font-semibold text-slate-900 mt-2">${formatNumber(totals.rooms)}</p>
        </div>
        <div class="rounded-lg bg-white border border-slate-200 p-5 hover:border-slate-300 transition-colors">
          <p class="text-sm text-slate-600 font-medium">Total Bookings</p>
          <p class="text-3xl font-semibold text-slate-900 mt-2">${formatNumber(totals.bookings)}</p>
        </div>
        <div class="rounded-lg bg-white border border-slate-200 p-5 hover:border-slate-300 transition-colors">
          <p class="text-sm text-slate-600 font-medium">Confirmed</p>
          <p class="text-3xl font-semibold text-slate-900 mt-2">${formatNumber(totals.confirmed)}</p>
        </div>
        <div class="rounded-lg bg-white border border-slate-200 p-5 hover:border-slate-300 transition-colors">
          <p class="text-sm text-slate-600 font-medium">Cancelled</p>
          <p class="text-3xl font-semibold text-slate-900 mt-2">${formatNumber(totals.cancelled)}</p>
        </div>
        <div class="rounded-lg bg-white border border-slate-200 p-5 hover:border-slate-300 transition-colors">
          <p class="text-sm text-slate-600 font-medium">Cancellation Rate</p>
          <p class="text-3xl font-semibold text-slate-900 mt-2">${totals.cancellation_rate}</p>
        </div>
      </section>
    `;

    if (top_room) {
      html += `
        <section class="rounded-lg bg-white border border-slate-200 p-6 hover:border-slate-300 transition-colors">
          <h3 class="text-base font-semibold text-slate-900 mb-4">Most Booked Room</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xl font-semibold text-slate-900">${top_room.name}</p>
              <p class="text-sm text-slate-500">${top_room.booking_count} bookings</p>
            </div>
            <div class="text-right">
              <p class="text-3xl font-semibold text-slate-900">${formatNumber(top_room.booking_count)}</p>
            </div>
          </div>
        </section>
      `;
    }

    if (peak_time) {
      html += `
        <section class="rounded-lg bg-white border border-slate-200 p-6 hover:border-slate-300 transition-colors">
          <h3 class="text-base font-semibold text-slate-900 mb-4">Peak Usage Time</h3>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xl font-semibold text-slate-900">${peak_time.start_time} - ${peak_time.end_time}</p>
              <p class="text-sm text-slate-600">${peak_time.usage_count} total uses</p>
            </div>
            <div class="text-right">
              <p class="text-3xl font-semibold text-slate-900">${formatNumber(peak_time.usage_count)}</p>
            </div>
          </div>
        </section>
      `;
    }

    return html;
  }

  function renderTable(title, columns, data) {
    if (!data || data.length === 0) {
      return `
        <section class="rounded-lg bg-white border border-slate-200 p-6 shadow-sm">
          <h3 class="text-lg font-bold text-slate-900 mb-4">${title}</h3>
          <p class="text-slate-500 text-center py-8">No data available</p>
        </section>
      `;
    }

    const headerHtml = columns.map(col => `<th class="px-4 py-3 text-left text-xs font-semibold text-slate-700">${col}</th>`).join('');
    
    const rowHtml = data.map(row => {
      const cellHtml = Object.values(row).map((val, idx) => {
        let displayVal = val;
        if (typeof val === 'number' && val > 100) {
          displayVal = formatNumber(val);
        } else if (typeof val === 'number') {
          displayVal = val.toFixed(2);
        }
        return `<td class="px-4 py-3 text-sm text-slate-900">${displayVal}</td>`;
      }).join('');
      return `<tr class="border-t border-slate-100 hover:bg-slate-50 transition-colors">${cellHtml}</tr>`;
    }).join('');

    return `
      <section class="rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors overflow-hidden">
        <div class="p-6 border-b border-slate-200">
          <h3 class="text-base font-semibold text-slate-900">${title}</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>${headerHtml}</tr>
            </thead>
            <tbody>
              ${rowHtml}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderFullReport(report) {
    const { sections } = report;
    let html = renderSummaryReport(report);

    if (!sections) return html;

    // Room Statistics
    if (sections.room_statistics && sections.room_statistics.data) {
      const columns = ['Room', 'Building', 'Capacity', 'Department', 'Total', 'Confirmed', 'Cancelled', 'Overridden'];
      const tableData = sections.room_statistics.data.map(room => ({
        'Room': room.name,
        'Building': room.building,
        'Capacity': room.capacity,
        'Department': room.department || 'N/A',
        'Total': room.total_bookings || 0,
        'Confirmed': room.confirmed_bookings || 0,
        'Cancelled': room.cancelled_bookings || 0,
        'Overridden': room.overridden_bookings || 0
      }));
      html += renderTable('Room Utilization', columns, tableData);
    }

    // Peak Hours
    if (sections.peak_hours && sections.peak_hours.data) {
      const columns = ['Time Slot', 'Total Bookings', 'Confirmed'];
      const tableData = sections.peak_hours.data.map(slot => ({
        'Time Slot': `${slot.start_time} - ${slot.end_time}`,
        'Total Bookings': slot.booking_count || 0,
        'Confirmed': slot.confirmed_count || 0
      }));
      html += renderTable('Peak Usage Hours', columns, tableData);
    }

    // Department Usage
    if (sections.department_usage && sections.department_usage.data) {
      const columns = ['Department', 'Total Bookings', 'Confirmed', 'Cancelled', 'Rooms Owned'];
      const tableData = sections.department_usage.data.map(dept => ({
        'Department': dept.name,
        'Total Bookings': dept.total_bookings || 0,
        'Confirmed': dept.confirmed_bookings || 0,
        'Cancelled': dept.cancelled_bookings || 0,
        'Rooms Owned': dept.rooms_owned || 0
      }));
      html += renderTable('Department-wise Usage', columns, tableData);
    }

    // Approval Statistics
    if (sections.approval_statistics && sections.approval_statistics.data) {
      const columns = ['Stage', 'Decision', 'Count', 'Emergency Overrides'];
      const tableData = sections.approval_statistics.data.map(stat => ({
        'Stage': stat.stage,
        'Decision': stat.decision,
        'Count': stat.count || 0,
        'Emergency Overrides': stat.emergency_override_count || 0
      }));
      html += renderTable('Approval Statistics', columns, tableData);
    }

    // Request Statistics
    if (sections.request_statistics && sections.request_statistics.data) {
      const columns = ['Status', 'Count', 'Avg Hours to Decision'];
      const tableData = sections.request_statistics.data.map(stat => ({
        'Status': stat.status,
        'Count': stat.count || 0,
        'Avg Hours to Decision': formatDuration(stat.avg_hours_to_decision)
      }));
      html += renderTable('Request Statistics', columns, tableData);
    }

    // Cancellation Analysis
    if (sections.cancellation_analysis && sections.cancellation_analysis.data) {
      const columns = ['Room', 'Total Cancellations', 'Cancellation %'];
      const tableData = sections.cancellation_analysis.data.map(room => ({
        'Room': room.room_name,
        'Total Cancellations': room.total_cancellations || 0,
        'Cancellation %': room.cancellation_percentage || 0
      }));
      html += renderTable('Cancellation Analysis', columns, tableData);
    }

    // Recent Activity
    if (sections.recent_activity && sections.recent_activity.data) {
      const columns = ['Date', 'Total', 'Confirmed', 'Rejected', 'Cancelled', 'Pending'];
      const tableData = sections.recent_activity.data.map(day => ({
        'Date': day.booking_date,
        'Total': day.total_requests || 0,
        'Confirmed': day.confirmed || 0,
        'Rejected': day.rejected || 0,
        'Cancelled': day.cancelled || 0,
        'Pending': day.pending || 0
      }));
      html += renderTable('Recent Activity (Last 7 Days)', columns, tableData);
    }

    // User Activity
    if (sections.user_activity && sections.user_activity.data) {
      const columns = ['User', 'Email', 'Role', 'Total Requests', 'Confirmed', 'Rejected', 'Cancelled'];
      const tableData = sections.user_activity.data.slice(0, 20).map(user => ({
        'User': user.name,
        'Email': user.email,
        'Role': user.role || 'N/A',
        'Total Requests': user.total_requests || 0,
        'Confirmed': user.confirmed_requests || 0,
        'Rejected': user.rejected_requests || 0,
        'Cancelled': user.cancelled_requests || 0
      }));
      html += renderTable('Top Users by Booking Requests', columns, tableData);
    }

    return html;
  }

  async function generateReport() {
    if (state.loading) return;

    disableControls();
    setNotice('Generating report...', 'info');

    try {
      const reportType = elements.reportType.value;
      const response = await window.API.request(`/api/reports/utilization?type=${reportType}`);

      state.currentReport = response;
      
      // Render report
      const html = reportType === 'summary' ? renderSummaryReport(response) : renderFullReport(response);
      elements.reportContainer.innerHTML = html;

      // Enable download button
      elements.downloadReportBtn.disabled = false;

      setNotice('Report generated successfully', 'success');
    } catch (error) {
      console.error('Report generation error:', error);
      setNotice(`Error: ${error.message}`, 'error');
    } finally {
      enableControls();
    }
  }

  function downloadReport() {
    if (!state.currentReport) return;

    const dataStr = JSON.stringify(state.currentReport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `room-utilization-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Set default report type
  elements.reportType.value = 'summary';

  // Event listeners
  elements.generateReportBtn.addEventListener('click', generateReport);
  elements.downloadReportBtn.addEventListener('click', downloadReport);

  // Mount UI components
  window.UIComponents.mountDemoUserSelect(document.createElement('select'), () => {
    // Reload report if user changes (disabled for reports)
  });

  setNotice('Ready to generate. Select a report type and click Generate.', 'info');
})();
