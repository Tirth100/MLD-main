package report;

import database.DatabaseHelper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.concurrent.CopyOnWriteArrayList;

public class ReportGenerator {

    private static final List<String> fallbackReports = new CopyOnWriteArrayList<>();
    private static int nextFallbackId = 1;

    public static void saveReport(Report report) {
        if (report == null || report.getTotalChecks() <= 0) {
            // Discard empty reports with 0 checks
            return;
        }

        String deviceId = report.getUsername() != null && report.getUsername().length() > 5 ? report.getUsername() : "local_device_1";
        String empName = DatabaseHelper.getEmployeeNameByUuid(deviceId);
        int scorePct = (int) Math.round(report.getAttentionScore() * 100);

        StringBuilder sbTimeline = new StringBuilder("[");
        if (report.getWindowTimeline() != null && report.getFocusTimeline() != null) {
            for (int i = 0; i < report.getWindowTimeline().size(); i++) {
                sbTimeline.append("{\"window\": \"").append(report.getWindowTimeline().get(i)).append("\", ");
                sbTimeline.append("\"focused\": ").append(report.getFocusTimeline().get(i)).append("}");
                if (i < report.getWindowTimeline().size() - 1) sbTimeline.append(",");
            }
        }
        sbTimeline.append("]");
        String timelineStr = sbTimeline.toString();
        String sessionCode = report.getSessionCode() != null ? report.getSessionCode().trim() : "";

        // Remove any prior duplicate fallback report for this user in this session to enforce 1 report per user
        fallbackReports.removeIf(rep -> {
            boolean matchesUser = rep.contains("\"name\": \"" + DatabaseHelper.escapeJson(empName) + "\"");
            boolean matchesSession = !sessionCode.isEmpty() && rep.contains("\"sessionCode\": \"" + sessionCode + "\"");
            return matchesUser && matchesSession;
        });

        int fallbackId = nextFallbackId++;
        int durSec = report.getTotalChecks() * 5;
        String jsonRecord = String.format(
            "{\"id\": %d, \"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"durationSeconds\": %d, \"webcamActive\": %b, \"sessionCode\": \"%s\", \"timestamp\": \"%s\", \"timeline\": %s}",
            fallbackId, DatabaseHelper.escapeJson(empName), scorePct, report.getParticipationLevel(), report.getTotalChecks(), report.getFocusedChecks(), durSec, report.isWebcamActive(), sessionCode, report.getTimestamp(), timelineStr
        );
        fallbackReports.add(0, jsonRecord);

        Connection conn = DatabaseHelper.connect();
        if (conn != null) {
            try {
                String ensureDeviceSql = "INSERT INTO devices(device_uuid) VALUES (?) ON CONFLICT DO NOTHING";
                try (PreparedStatement devStmt = conn.prepareStatement(ensureDeviceSql)) {
                    devStmt.setString(1, deviceId);
                    devStmt.executeUpdate();
                }

                // Check if a report row already exists for this user in this meeting session
                String checkSql = "SELECT log_id FROM engagement_logs WHERE session_code = ? AND device_uuid = ?";
                int existingLogId = -1;
                try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                    checkStmt.setString(1, sessionCode);
                    checkStmt.setString(2, deviceId);
                    try (ResultSet rs = checkStmt.executeQuery()) {
                        if (rs.next()) {
                            existingLogId = rs.getInt("log_id");
                        }
                    }
                }

                if (existingLogId != -1) {
                    // Update the existing record with the final complete end-of-meeting report
                    String updateSql = "UPDATE engagement_logs SET score = ?, status = ?, total_checks = ?, focused_checks = ?, webcam_active = ?, timestamp = ?, timeline = ?, is_live = false WHERE log_id = ?";
                    try (PreparedStatement updateStmt = conn.prepareStatement(updateSql)) {
                        updateStmt.setDouble(1, report.getAttentionScore());
                        updateStmt.setString(2, report.getParticipationLevel());
                        updateStmt.setInt(3, report.getTotalChecks());
                        updateStmt.setInt(4, report.getFocusedChecks());
                        updateStmt.setBoolean(5, report.isWebcamActive());
                        try {
                            updateStmt.setTimestamp(6, java.sql.Timestamp.valueOf(report.getTimestamp()));
                        } catch (Exception te) {
                            updateStmt.setTimestamp(6, new java.sql.Timestamp(System.currentTimeMillis()));
                        }
                        updateStmt.setString(7, timelineStr);
                        updateStmt.setInt(8, existingLogId);
                        updateStmt.executeUpdate();
                        System.out.println("Updated existing report (log_id: " + existingLogId + ") for session " + sessionCode);
                    }
                } else {
                    // Insert final report record
                    String insertSql = "INSERT INTO engagement_logs(session_code, device_uuid, score, status, total_checks, focused_checks, webcam_active, timestamp, timeline, is_live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, false)";
                    try (PreparedStatement pstmt = conn.prepareStatement(insertSql)) {
                        pstmt.setString(1, sessionCode);
                        pstmt.setString(2, deviceId);
                        pstmt.setDouble(3, report.getAttentionScore());
                        pstmt.setString(4, report.getParticipationLevel());
                        pstmt.setInt(5, report.getTotalChecks());
                        pstmt.setInt(6, report.getFocusedChecks());
                        pstmt.setBoolean(7, report.isWebcamActive());
                        try {
                            pstmt.setTimestamp(8, java.sql.Timestamp.valueOf(report.getTimestamp()));
                        } catch (Exception te) {
                            pstmt.setTimestamp(8, new java.sql.Timestamp(System.currentTimeMillis()));
                        }
                        pstmt.setString(9, timelineStr);
                        pstmt.executeUpdate();
                        System.out.println("Report saved to PostgreSQL database successfully.");
                    }
                }
            } catch (SQLException e) {
                System.err.println("Error saving report to DB: " + e.getMessage());
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
    }

    public static String getAllReportsAsJsonArray(int orgId) {
        Connection conn = DatabaseHelper.connect();
        if (conn != null) {
            StringBuilder jsonArray = new StringBuilder("[");
            String sql = "SELECT e.*, u.name as user_name FROM engagement_logs e " +
                         "LEFT JOIN devices d ON e.device_uuid = d.device_uuid " +
                         "LEFT JOIN users u ON d.user_id = u.user_id " +
                         "WHERE u.org_id = ? AND (e.is_live IS FALSE OR e.is_live IS NULL) AND e.total_checks > 0 " +
                         "ORDER BY e.timestamp DESC";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setInt(1, orgId);
                try (ResultSet rs = pstmt.executeQuery()) {
                    boolean first = true;
                    Set<String> seenUserSessions = new HashSet<>();
                    while (rs.next()) {
                        String sessionCode = rs.getString("session_code");
                        String deviceUuid = rs.getString("device_uuid");
                        String name = rs.getString("user_name");
                        
                        // Deduplicate: strictly 1 report per user per meeting session
                        String key = (sessionCode != null ? sessionCode.trim().toUpperCase() : "NO_SESSION") + "_" + 
                                     (deviceUuid != null ? deviceUuid.trim() : (name != null ? name.trim() : ""));
                        if (!seenUserSessions.add(key)) {
                            continue;
                        }

                        if (!first) jsonArray.append(",");
                        jsonArray.append("{");
                        int totalChecks = rs.getInt("total_checks");
                        int focusedChecks = rs.getInt("focused_checks");
                        
                        jsonArray.append("\"id\": ").append(rs.getInt("log_id")).append(",");
                        jsonArray.append("\"name\": \"").append(DatabaseHelper.escapeJson(name != null ? name : "Local System User")).append("\",");
                        jsonArray.append("\"role\": \"Employee\",");
                        jsonArray.append("\"score\": ").append(Math.round(rs.getDouble("score") * 100)).append(",");
                        jsonArray.append("\"status\": \"").append(rs.getString("status")).append("\",");
                        jsonArray.append("\"totalChecks\": ").append(totalChecks).append(",");
                        jsonArray.append("\"focusedChecks\": ").append(focusedChecks).append(",");
                        jsonArray.append("\"durationSeconds\": ").append(totalChecks * 5).append(",");
                        jsonArray.append("\"webcamActive\": ").append(rs.getBoolean("webcam_active")).append(",");
                        jsonArray.append("\"sessionCode\": \"").append(sessionCode != null ? sessionCode : "").append("\",");
                        jsonArray.append("\"timestamp\": \"").append(rs.getString("timestamp") != null ? rs.getString("timestamp") : "").append("\",");
                        String timeline = rs.getString("timeline");
                        jsonArray.append("\"timeline\": ").append(timeline != null && !timeline.isEmpty() ? timeline : "[]");
                        jsonArray.append("}");
                        first = false;
                    }
                    jsonArray.append("]");
                    conn.close();
                    return jsonArray.toString();
                }
            } catch (SQLException e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback reports array with deduplication (1 report per user per session)
        StringBuilder jsonArray = new StringBuilder("[");
        Set<String> seenFallback = new HashSet<>();
        boolean firstFallback = true;
        for (String rep : fallbackReports) {
            String sessionCode = "";
            String name = "";
            if (rep.contains("\"sessionCode\": \"")) {
                int s = rep.indexOf("\"sessionCode\": \"") + 16;
                int e = rep.indexOf("\"", s);
                if (e != -1) sessionCode = rep.substring(s, e);
            }
            if (rep.contains("\"name\": \"")) {
                int s = rep.indexOf("\"name\": \"") + 9;
                int e = rep.indexOf("\"", s);
                if (e != -1) name = rep.substring(s, e);
            }
            String key = sessionCode + "_" + name;
            if (!key.equals("_") && !seenFallback.add(key)) {
                continue;
            }
            if (!firstFallback) jsonArray.append(",");
            jsonArray.append(rep);
            firstFallback = false;
        }
        jsonArray.append("]");
        return jsonArray.toString();
    }

    public static boolean deleteReportForOrganization(int reportId, String timestampStr, String sessionCode, int orgId) {
        boolean fallbackDeleted = fallbackReports.removeIf(rep -> {
            if (reportId > 0 && (rep.contains("\"id\": " + reportId + ",") || rep.contains("\"id\":" + reportId + ","))) {
                return true;
            }
            if (timestampStr != null && !timestampStr.isBlank() && rep.contains("\"timestamp\": \"" + timestampStr + "\"")) {
                if (sessionCode != null && !sessionCode.isBlank()) {
                    return rep.contains("\"sessionCode\": \"" + sessionCode + "\"");
                }
                return true;
            }
            return false;
        });

        Connection conn = DatabaseHelper.connect();
        boolean dbDeleted = false;
        if (conn != null) {
            try {
                if (reportId > 0) {
                    // Precise deletion by log_id with org authorization check
                    String sql = "DELETE FROM engagement_logs WHERE log_id = ? AND (" +
                                 "device_uuid IN (SELECT d.device_uuid FROM devices d JOIN users u ON d.user_id = u.user_id WHERE u.org_id = ?) " +
                                 "OR session_code IN (SELECT s.session_code FROM sessions s WHERE s.org_id = ?) " +
                                 "OR NOT EXISTS (SELECT 1 FROM devices d JOIN users u ON d.user_id = u.user_id WHERE d.device_uuid = engagement_logs.device_uuid AND u.org_id != ?))";
                    try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                        pstmt.setInt(1, reportId);
                        pstmt.setInt(2, orgId);
                        pstmt.setInt(3, orgId);
                        pstmt.setInt(4, orgId);
                        int rows = pstmt.executeUpdate();
                        if (rows > 0) dbDeleted = true;
                    }
                } else if (timestampStr != null && !timestampStr.isBlank()) {
                    String sql = "DELETE FROM engagement_logs WHERE timestamp = ?::timestamp AND (" +
                                 "device_uuid IN (SELECT d.device_uuid FROM devices d JOIN users u ON d.user_id = u.user_id WHERE u.org_id = ?) " +
                                 "OR session_code IN (SELECT s.session_code FROM sessions s WHERE s.org_id = ?) " +
                                 "OR NOT EXISTS (SELECT 1 FROM devices d JOIN users u ON d.user_id = u.user_id WHERE d.device_uuid = engagement_logs.device_uuid AND u.org_id != ?))";
                    try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                        pstmt.setString(1, timestampStr);
                        pstmt.setInt(2, orgId);
                        pstmt.setInt(3, orgId);
                        pstmt.setInt(4, orgId);
                        int rows = pstmt.executeUpdate();
                        if (rows > 0) dbDeleted = true;
                    }
                }
            } catch (SQLException e) {
                System.err.println("Error deleting report: " + e.getMessage());
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        return dbDeleted || fallbackDeleted;
    }

    public static boolean deleteReportForOrganization(String timestampStr, int orgId) {
        return deleteReportForOrganization(-1, timestampStr, null, orgId);
    }
}
