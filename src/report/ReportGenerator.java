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
        if (report == null) {
            return;
        }

        int totalChecks = report.getTotalChecks();
        int focusedChecks = report.getFocusedChecks();
        double finalScore = totalChecks > 0 ? ((double) focusedChecks / totalChecks) : (report.getAttentionScore() <= 1.0 ? report.getAttentionScore() : report.getAttentionScore() / 100.0);
        finalScore = Math.min(1.0, Math.max(0.0, finalScore));
        int scorePct = (int) Math.round(finalScore * 100);
        String participation = (report.getParticipationLevel() != null && !report.getParticipationLevel().isBlank())
                ? report.getParticipationLevel() : (totalChecks > 0 ? new service.LeechDetector().checkLeech(finalScore) : "Low Engagement");

        String deviceId = report.getUsername() != null && report.getUsername().length() > 5 ? report.getUsername() : "local_device_1";
        String empName = DatabaseHelper.getEmployeeNameByUuid(deviceId);

        StringBuilder sbTimeline = new StringBuilder("[");
        if (report.getWindowTimeline() != null && report.getFocusTimeline() != null && !report.getWindowTimeline().isEmpty()) {
            for (int i = 0; i < report.getWindowTimeline().size(); i++) {
                String win = report.getWindowTimeline().get(i);
                boolean isAi = win != null && (win.contains("[AI Detected") || win.contains("[AI Tool") || win.contains("Capture Evasion"));
                sbTimeline.append("{\"window\": \"").append(DatabaseHelper.escapeJson(win)).append("\", ");
                sbTimeline.append("\"focused\": ").append(report.getFocusTimeline().get(i)).append(", ");
                sbTimeline.append("\"aiDetected\": ").append(isAi).append("}");
                if (i < report.getWindowTimeline().size() - 1) sbTimeline.append(",");
            }
        } else {
            sbTimeline.append("{\"window\": \"Meeting Workspace\", \"focused\": true, \"aiDetected\": false}");
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
        int durSec = totalChecks * 5;
        String jsonRecord = String.format(
            "{\"id\": %d, \"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"durationSeconds\": %d, \"webcamActive\": %b, \"sessionCode\": \"%s\", \"timestamp\": \"%s\", \"timeline\": %s}",
            fallbackId, DatabaseHelper.escapeJson(empName), scorePct, participation, totalChecks, focusedChecks, durSec, report.isWebcamActive(), sessionCode, report.getTimestamp(), timelineStr
        );
        fallbackReports.add(0, jsonRecord);

        Connection conn = DatabaseHelper.connect();
        if (conn != null) {
            try {
                int userId = DatabaseHelper.getUserIdFromToken(deviceId);
                if (userId > 0) {
                    String ensureDeviceSql = "INSERT INTO devices(device_uuid, user_id) VALUES (?, ?) " +
                                             "ON CONFLICT (device_uuid) DO UPDATE SET user_id = EXCLUDED.user_id";
                    try (PreparedStatement devStmt = conn.prepareStatement(ensureDeviceSql)) {
                        devStmt.setString(1, deviceId);
                        devStmt.setInt(2, userId);
                        devStmt.executeUpdate();
                    }
                    if (!deviceId.equalsIgnoreCase(deviceId.toLowerCase())) {
                        try (PreparedStatement devStmt = conn.prepareStatement(ensureDeviceSql)) {
                            devStmt.setString(1, deviceId.toLowerCase());
                            devStmt.setInt(2, userId);
                            devStmt.executeUpdate();
                        }
                    }
                } else {
                    String ensureDeviceSql = "INSERT INTO devices(device_uuid) VALUES (?) ON CONFLICT DO NOTHING";
                    try (PreparedStatement devStmt = conn.prepareStatement(ensureDeviceSql)) {
                        devStmt.setString(1, deviceId);
                        devStmt.executeUpdate();
                    }
                }

                // Check if a report row already exists for this user in this meeting session
                String checkSql = "SELECT log_id FROM engagement_logs WHERE session_code = ? AND LOWER(device_uuid) = LOWER(?)";
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
                        updateStmt.setDouble(1, finalScore);
                        updateStmt.setString(2, participation);
                        updateStmt.setInt(3, totalChecks);
                        updateStmt.setInt(4, focusedChecks);
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
                        pstmt.setDouble(3, finalScore);
                        pstmt.setString(4, participation);
                        pstmt.setInt(5, totalChecks);
                        pstmt.setInt(6, focusedChecks);
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
        return getAllReportsAsJsonArray(orgId, -1, null);
    }

    public static String getAllReportsAsJsonArray(int orgId, int userId, String filterName) {
        Connection conn = DatabaseHelper.connect();
        if (conn != null) {
            StringBuilder jsonArray = new StringBuilder("[");
            String sql;
            if (userId > 0) {
                sql = "SELECT e.*, u.name as user_name FROM engagement_logs e " +
                      "LEFT JOIN devices d ON LOWER(e.device_uuid) = LOWER(d.device_uuid) " +
                      "LEFT JOIN users u ON d.user_id = u.user_id " +
                      "WHERE u.org_id = ? AND u.user_id = ? AND (e.is_live IS FALSE OR e.is_live IS NULL) AND (e.total_checks >= 1 OR e.total_checks IS NOT NULL) " +
                      "ORDER BY e.timestamp DESC";
            } else {
                sql = "SELECT e.*, u.name as user_name FROM engagement_logs e " +
                      "LEFT JOIN devices d ON LOWER(e.device_uuid) = LOWER(d.device_uuid) " +
                      "LEFT JOIN users u ON d.user_id = u.user_id " +
                      "WHERE (u.org_id = ? OR (u.org_id IS NULL AND ? = 1)) AND (e.is_live IS FALSE OR e.is_live IS NULL) AND (e.total_checks >= 1 OR e.total_checks IS NOT NULL) " +
                      "ORDER BY e.timestamp DESC";
            }
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setInt(1, orgId);
                if (userId > 0) {
                    pstmt.setInt(2, userId);
                } else {
                    pstmt.setInt(2, orgId);
                }
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
                        int scorePct;
                        if (totalChecks > 0) {
                            scorePct = (int) Math.round(((double) focusedChecks / totalChecks) * 100);
                        } else {
                            double dbScore = rs.getDouble("score");
                            scorePct = dbScore <= 1.0 ? (int) Math.round(dbScore * 100) : (int) Math.round(dbScore);
                        }
                        scorePct = Math.min(100, Math.max(0, scorePct));

                        String status = rs.getString("status");
                        if (status == null || status.isBlank()) {
                            status = new service.LeechDetector().checkLeech(scorePct / 100.0);
                        }
                        
                        jsonArray.append("\"id\": ").append(rs.getInt("log_id")).append(",");
                        jsonArray.append("\"name\": \"").append(DatabaseHelper.escapeJson(name != null ? name : "Local System User")).append("\",");
                        jsonArray.append("\"role\": \"Employee\",");
                        jsonArray.append("\"score\": ").append(scorePct).append(",");
                        jsonArray.append("\"status\": \"").append(DatabaseHelper.escapeJson(status)).append("\",");
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
            if (filterName != null && !filterName.isBlank() && !name.equalsIgnoreCase(filterName.trim())) {
                continue;
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
