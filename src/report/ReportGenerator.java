package report;

import database.DatabaseHelper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class ReportGenerator {

    private static final List<String> fallbackReports = new CopyOnWriteArrayList<>();

    public static void saveReport(Report report) {
        String deviceId = report.getUsername() != null && report.getUsername().length() > 5 ? report.getUsername() : "local_device_1";
        String empName = DatabaseHelper.getEmployeeNameByUuid(deviceId);
        int scorePct = (int) Math.round(report.getAttentionScore() * 100);

        StringBuilder sbTimeline = new StringBuilder("[");
        if (report.getWindowTimeline() != null && report.getFocusTimeline() != null) {
            for (int i = 0; i < report.getWindowTimeline().size(); i++) {
                // Window titles are already JSON-escaped by AttentionAnalyzer when they were
                // captured - do not re-escape/mangle them here (a prior version replaced the
                // quote in an already-escaped \" with an apostrophe, producing invalid JSON).
                sbTimeline.append("{\"window\": \"").append(report.getWindowTimeline().get(i)).append("\", ");
                sbTimeline.append("\"focused\": ").append(report.getFocusTimeline().get(i)).append("}");
                if (i < report.getWindowTimeline().size() - 1) sbTimeline.append(",");
            }
        }
        sbTimeline.append("]");
        String timelineStr = sbTimeline.toString();

        String jsonRecord = String.format(
            "{\"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"webcamActive\": %b, \"sessionCode\": \"%s\", \"timestamp\": \"%s\", \"timeline\": %s}",
            DatabaseHelper.escapeJson(empName), scorePct, report.getParticipationLevel(), report.getTotalChecks(), report.getFocusedChecks(), report.isWebcamActive(), report.getSessionCode(), report.getTimestamp(), timelineStr
        );
        fallbackReports.add(0, jsonRecord);

        String insertSql = "INSERT INTO engagement_logs(session_code, device_uuid, score, status, total_checks, focused_checks, webcam_active, timestamp, timeline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        String ensureDeviceSql = "INSERT INTO devices(device_uuid) VALUES (?) ON CONFLICT DO NOTHING";
        
        Connection conn = DatabaseHelper.connect();
        if (conn != null) {
            try {
                try (PreparedStatement devStmt = conn.prepareStatement(ensureDeviceSql)) {
                    devStmt.setString(1, deviceId);
                    devStmt.executeUpdate();
                }
                
                try (PreparedStatement pstmt = conn.prepareStatement(insertSql)) {
                    pstmt.setString(1, report.getSessionCode());
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
            String sql = "SELECT e.*, u.name as user_name FROM engagement_logs e LEFT JOIN devices d ON e.device_uuid = d.device_uuid LEFT JOIN users u ON d.user_id = u.user_id WHERE u.org_id = ? ORDER BY e.timestamp DESC";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setInt(1, orgId);
                try (ResultSet rs = pstmt.executeQuery()) {
                
                boolean first = true;
                while (rs.next()) {
                    if (!first) jsonArray.append(",");
                    jsonArray.append("{");
                    String name = rs.getString("user_name");
                    
                    int totalChecks = rs.getInt("total_checks");
                    int focusedChecks = rs.getInt("focused_checks");
                    
                    jsonArray.append("\"name\": \"").append(DatabaseHelper.escapeJson(name != null ? name : "Local System User")).append("\",");
                    jsonArray.append("\"role\": \"Employee\",");
                    jsonArray.append("\"score\": ").append(Math.round(rs.getDouble("score") * 100)).append(",");
                    jsonArray.append("\"status\": \"").append(rs.getString("status")).append("\",");
                    jsonArray.append("\"totalChecks\": ").append(totalChecks).append(",");
                    jsonArray.append("\"focusedChecks\": ").append(focusedChecks).append(",");
                    jsonArray.append("\"webcamActive\": ").append(rs.getBoolean("webcam_active")).append(",");
                    jsonArray.append("\"sessionCode\": \"").append(rs.getString("session_code") != null ? rs.getString("session_code") : "").append("\",");
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

        // Fallback reports array
        StringBuilder jsonArray = new StringBuilder("[");
        for (int i = 0; i < fallbackReports.size(); i++) {
            jsonArray.append(fallbackReports.get(i));
            if (i < fallbackReports.size() - 1) jsonArray.append(",");
        }
        jsonArray.append("]");
        return jsonArray.toString();
    }

    public static boolean deleteReportForOrganization(String timestampStr, int orgId) {
        fallbackReports.removeIf(rep -> rep.contains("\"timestamp\": \"" + timestampStr + "\""));

        Connection conn = DatabaseHelper.connect();
        boolean deleted = false;
        if (conn != null) {
            String sql = "DELETE FROM engagement_logs WHERE timestamp = ?::timestamp AND session_code IN (SELECT session_code FROM sessions WHERE org_id = ?)";
            try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                pstmt.setString(1, timestampStr);
                pstmt.setInt(2, orgId);
                int rows = pstmt.executeUpdate();
                if (rows > 0) deleted = true;
            } catch (SQLException e) {
                System.err.println("Error deleting report: " + e.getMessage());
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        return deleted;
    }
}

