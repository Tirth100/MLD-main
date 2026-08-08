/**
 * Handles exporting engagement data to a beautifully formatted XLSX file
 * which natively works with Google Sheets, including multiple tabs (one per date)
 * and color-coded rows (Green/Yellow/Red).
 */

window.exportToGoogleSheets = async function() {
    try {
        const data = await window.api.get('/engagement');
        if (!data || data.length === 0) {
            alert("No data available to export.");
            return;
        }

        // Group data by Date
        const groupedByDate = {};
        
        // Only consider the last 7 days for "one week duration only"
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        data.forEach(emp => {
            if (!emp.timestamp) return;
            const recordDateStr = emp.timestamp.split(' ')[0]; // yyyy-mm-dd
            
            // Assuming timestamp is in format "yyyy-MM-dd HH:mm:ss"
            const dateObj = new Date(recordDateStr);
            if (dateObj >= oneWeekAgo) {
                if (!groupedByDate[recordDateStr]) {
                    groupedByDate[recordDateStr] = [];
                }
                groupedByDate[recordDateStr].push(emp);
            }
        });

        // Initialize Workbook
        const wb = XLSX.utils.book_new();
        
        const dates = Object.keys(groupedByDate).sort();
        if (dates.length === 0) {
            alert("No data found for the past week.");
            return;
        }

        dates.forEach(dateStr => {
            const records = groupedByDate[dateStr];
            
            // Format data for sheet
            const sheetData = records.map(emp => {
                return {
                    "Employee": emp.name,
                    "Role": emp.role || 'Employee',
                    "Avg Score (%)": emp.score,
                    "Status": emp.status.toUpperCase(),
                    "Session Code": emp.sessionCode || 'N/A',
                    "Timestamp": emp.timestamp,
                    "Total Checks": emp.totalChecks,
                    "Focused Checks": emp.focusedChecks,
                    "Duration (s)": emp.durationSeconds || 0,
                    "Idle (s)": emp.idleSeconds || 0
                };
            });

            // Create Worksheet
            const ws = XLSX.utils.json_to_sheet(sheetData);

            // Set column widths
            const colWidths = [
                {wch: 20}, {wch: 15}, {wch: 15}, {wch: 15}, 
                {wch: 15}, {wch: 22}, {wch: 12}, {wch: 15}, 
                {wch: 12}, {wch: 12}
            ];
            ws['!cols'] = colWidths;

            // Apply Styles to rows based on Status
            // xlsx-js-style uses 0-based indexing for rows/cols in A1 notation map
            const range = XLSX.utils.decode_range(ws['!ref']);
            
            // Style Header Row
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({r: 0, c: C});
                if (!ws[cellRef]) continue;
                ws[cellRef].s = {
                    font: { bold: true, color: { rgb: "FFFFFFFF" } },
                    fill: { fgColor: { rgb: "FF4F46E5" } }, // Indigo
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            // Style Data Rows
            for (let R = 1; R <= range.e.r; ++R) {
                // Status is in the 4th column (Index 3)
                const statusCellRef = XLSX.utils.encode_cell({r: R, c: 3});
                const statusCell = ws[statusCellRef];
                let rowColor = "FFFFFFFF"; // Default white
                let fontColor = "FF000000";
                
                if (statusCell && statusCell.v) {
                    const statusVal = statusCell.v.toLowerCase();
                    if (statusVal === 'low engagement') {
                        rowColor = "FFFFC7CE"; // Light Red
                        fontColor = "FF9C0006"; // Dark Red Text
                    } else if (statusVal === 'engaging' || statusVal === 'focused') {
                        rowColor = "FFC6EFCE"; // Light Green
                        fontColor = "FF006100"; // Dark Green Text
                    } else {
                        rowColor = "FFFFEB9C"; // Light Yellow
                        fontColor = "FF9C5700"; // Dark Yellow Text
                    }
                }

                // Apply style to all cells in this row
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellRef = XLSX.utils.encode_cell({r: R, c: C});
                    if (!ws[cellRef]) continue;
                    ws[cellRef].s = {
                        fill: { fgColor: { rgb: rowColor } },
                        font: { color: { rgb: fontColor } },
                        alignment: { horizontal: C === 0 ? "left" : "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "FFE0E0E0" } },
                            bottom: { style: "thin", color: { rgb: "FFE0E0E0" } }
                        }
                    };
                }
            }

            // Append sheet to workbook (Tab name = date)
            XLSX.utils.book_append_sheet(wb, ws, dateStr);
        });

        // Write File
        const fileName = `MLD_Engagement_Report_Week_Of_${dates[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        // Show Google Sheets instructions using Bootstrap Modal instead of prompt
        showGoogleSheetsInstructionModal(fileName);

    } catch(e) {
        console.error("Export failed", e);
        alert("Export failed: " + e.message);
    }
};

function showGoogleSheetsInstructionModal(fileName) {
    // Check if modal exists, if not create it
    let modalEl = document.getElementById('googleSheetsModal');
    if (!modalEl) {
        const modalHtml = `
            <div class="modal fade" id="googleSheetsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header bg-primary text-white border-0">
                            <h5 class="modal-title"><i class="bi bi-file-earmark-spreadsheet me-2"></i>Export Successful</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4 text-center">
                            <div class="mb-4">
                                <i class="bi bi-cloud-check text-success display-1"></i>
                            </div>
                            <h4 class="fw-bold mb-3">Your Report is Ready!</h4>
                            <p class="text-muted mb-4">
                                The file <strong>${fileName}</strong> has been downloaded to your computer.
                            </p>
                            <div class="bg-light p-3 rounded border text-start mb-0">
                                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-google me-2"></i>How to open in Google Sheets online:</h6>
                                <ol class="mb-0 small text-muted">
                                    <li class="mb-1">Open your <a href="https://drive.google.com" target="_blank" class="fw-bold text-decoration-none">Google Drive</a> online.</li>
                                    <li class="mb-1">Drag and drop the downloaded <strong>.xlsx</strong> file into Drive.</li>
                                    <li>Double-click it! It will open seamlessly with all tabs and color-coding intact.</li>
                                </ol>
                            </div>
                        </div>
                        <div class="modal-footer border-0 justify-content-center pb-4">
                            <button type="button" class="btn btn-primary px-4" data-bs-dismiss="modal">Got it!</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modalEl = document.getElementById('googleSheetsModal');
    }
    
    // Update filename in modal
    const modalBody = modalEl.querySelector('.modal-body p strong');
    if (modalBody) modalBody.textContent = fileName;
    
    // Show modal
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}
