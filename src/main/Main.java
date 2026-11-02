package main;

import api.ApiServer;

import service.AttentionAnalyzer;
import service.LeechDetector;
import report.Report;
import database.DatabaseHelper;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

public class Main {

    public static class SessionState {
        public String sessionCode;
        public ScheduledExecutorService scheduler;

        public SessionState(String sessionCode) {
            this.sessionCode = sessionCode;
            this.scheduler = Executors.newScheduledThreadPool(1);
        }
    }

    public static Map<Integer, SessionState> orgSessions = new ConcurrentHashMap<>();
    
    // Legacy support for single-tenant / global access
    public static Map<String, AttentionAnalyzer> analyzers = new ConcurrentHashMap<>();
    public static String currentSessionCode = "";

    public static boolean isMonitoringActive() {
        return isMonitoringActive(1);
    }

    public static boolean isMonitoringActive(int orgId) {
        SessionState state = orgSessions.get(orgId);
        return state != null && state.scheduler != null && !state.scheduler.isShutdown();
    }

    public static void startMonitoring(String sessionCode) {
        startMonitoring(1, sessionCode);
    }

    public static void startMonitoring(int orgId, String sessionCode) {
        SessionState state = orgSessions.get(orgId);
        if (state == null || state.scheduler.isShutdown()) {
            // Delete all previously shown alerts as soon as a new meeting gets started
            api.ApiServer.clearOrgAlerts(orgId);

            state = new SessionState(sessionCode);
            orgSessions.put(orgId, state);
            
            if (orgId == 1) {
                currentSessionCode = sessionCode;
            }
            
            System.out.println("Distributed monitoring session started for Org " + orgId + " with session " + sessionCode + " (previous alerts cleared)");
        }
    }

    public static void stopMonitoring() {
        stopMonitoring(1);
    }

    public static void stopMonitoring(int orgId) {
        SessionState state = orgSessions.remove(orgId);
        if (state == null) {
            System.out.println("No active monitoring session found for Org " + orgId);
            return;
        }

        System.out.println("\nMonitoring session stopped for Org " + orgId + "! Saving all client reports...");
        
        java.util.Set<String> savedUuids = new java.util.HashSet<>();
        java.util.Set<Integer> savedUserIds = new java.util.HashSet<>();

        for (Map.Entry<String, AttentionAnalyzer> entry : analyzers.entrySet()) {
            String clientUuid = entry.getKey();
            int clientOrgId = DatabaseHelper.getOrgIdFromToken(clientUuid);
            if (clientOrgId == -1 && clientUuid != null) {
                clientOrgId = DatabaseHelper.getOrgIdFromToken(clientUuid.toLowerCase());
            }
            if (clientOrgId == orgId) {
                try {
                    AttentionAnalyzer clientAnalyzer = entry.getValue();
                    
                    int totalCnt = clientAnalyzer.getTotalCount();
                    int focusedCnt = clientAnalyzer.getFocusedCount();
                    double finalScore = totalCnt > 0 ? ((double) focusedCnt / totalCnt) : 0.0;
                    String status = totalCnt > 0 ? new LeechDetector().checkLeech(finalScore) : "Low Engagement";
                    
                    Report sessionReport = new Report(clientUuid, state.sessionCode, totalCnt, focusedCnt,
                            clientAnalyzer.isWebcamActive(),
                            finalScore, status, clientAnalyzer.getWindowTimeline(), clientAnalyzer.getFocusTimeline());
                    sessionReport.setJoinTime(clientAnalyzer.getJoinTimeFormatted());
                    report.ReportGenerator.saveReport(sessionReport);
                    
                    savedUuids.add(clientUuid.toLowerCase());
                    int uid = DatabaseHelper.getUserIdFromToken(clientUuid);
                    if (uid > 0) savedUserIds.add(uid);

                    System.out.println("Saved report for " + clientUuid + " with score: " + (Math.round(finalScore * 100)) + "%");

                    // Immediately record alert for Leech detected employee (< 50% focus threshold)
                    if (finalScore < 0.50 || "Low Engagement".equalsIgnoreCase(status)) {
                        String empName = DatabaseHelper.getEmployeeNameByUuid(clientUuid);
                        if (empName == null || empName.isBlank()) {
                            empName = "Employee (" + (clientUuid.length() > 6 ? clientUuid.substring(0, 6) : clientUuid) + ")";
                        }
                        int scorePct = (int) Math.round(finalScore * 100);
                        String reason = String.format("Leech detected: Low engagement of %d%% (< 50%% threshold) in meeting session %s", scorePct, state.sessionCode);
                        String timeStr = new java.text.SimpleDateFormat("hh:mm:ss a").format(new java.util.Date());
                        api.ApiServer.addOrgAlert(orgId, empName, state.sessionCode, scorePct, reason, timeStr);
                        System.out.println("[Alert] Leech alert recorded for " + empName + " (" + scorePct + "%) in session " + state.sessionCode);
                    }
                } catch (Exception e) {
                    System.err.println("Error saving client report: " + e.getMessage());
                }
                analyzers.remove(clientUuid);
            }
        }

        // Also ensure any participant who joined this session but had no analyzer ticks is saved (without duplicate)
        try {
            for (Map.Entry<String, String> joined : api.ApiServer.getActiveJoinedSessions().entrySet()) {
                String joinedUuid = joined.getKey();
                String sCode = joined.getValue();
                if (state.sessionCode.equalsIgnoreCase(sCode)) {
                    int jOrg = DatabaseHelper.getOrgIdFromToken(joinedUuid);
                    if (jOrg == -1) jOrg = DatabaseHelper.getOrgIdFromToken(joinedUuid.toLowerCase());
                    if (jOrg == orgId) {
                        int jUid = DatabaseHelper.getUserIdFromToken(joinedUuid);
                        if (savedUuids.contains(joinedUuid.toLowerCase()) || (jUid > 0 && savedUserIds.contains(jUid))) {
                            continue; // Already saved
                        }
                        savedUuids.add(joinedUuid.toLowerCase());
                        if (jUid > 0) savedUserIds.add(jUid);

                        Report joinedReport = new Report(joinedUuid, state.sessionCode, 0, 0, false, 0.0, "Low Engagement",
                                java.util.Collections.singletonList("Meeting Session"), java.util.Collections.singletonList(false));
                        report.ReportGenerator.saveReport(joinedReport);
                        System.out.println("Saved joined participant attendance report for " + joinedUuid);
                    }
                }
            }
        } catch (Exception ex) {
            System.err.println("Error saving joined session participants: " + ex.getMessage());
        }
        
        if (state.scheduler != null && !state.scheduler.isShutdown()) {
            state.scheduler.shutdown();
        }
        
        if (orgId == 1) {
            currentSessionCode = "";
        }
        // Note: analyzers.clear() used to run here unconditionally. The loop above already
        // removes exactly this org's entries from the shared `analyzers` map via
        // getOrgIdFromToken(...) == orgId, so clearing the whole map on top of that was
        // wiping out any other org's still-active, not-yet-saved session data whenever org 1
        // stopped its own session. Removed - per-org cleanup above is sufficient.
        System.out.println("Org " + orgId + " session saved and monitoring reset.");
    }

    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("      MEETING LEECH DETECTOR (MLD) - SERVER       ");
        System.out.println("==================================================");

        DatabaseHelper.initializeDatabase();

        try {
            ApiServer apiServer = new ApiServer();
            apiServer.startServer();
        } catch (IOException e) {
            System.err.println("Fatal Error: Could not start API server on port 3000.");
            e.printStackTrace();
        }
    }
}