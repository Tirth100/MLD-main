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
            state = new SessionState(sessionCode);
            orgSessions.put(orgId, state);
            
            if (orgId == 1) {
                currentSessionCode = sessionCode;
            }
            
            System.out.println("Distributed monitoring session started for Org " + orgId + " with session " + sessionCode);
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
        
        for (Map.Entry<String, AttentionAnalyzer> entry : analyzers.entrySet()) {
            String clientUuid = entry.getKey();
            if (DatabaseHelper.getOrgIdFromToken(clientUuid) == orgId) {
                try {
                    AttentionAnalyzer clientAnalyzer = entry.getValue();
                    
                    double finalScore = clientAnalyzer.getAttentionScore();
                    String status = new LeechDetector().checkLeech(finalScore);
                    
                    Report sessionReport = new Report(clientUuid, state.sessionCode, clientAnalyzer.getTotalCount(), clientAnalyzer.getFocusedCount(),
                            clientAnalyzer.isWebcamActive(),
                            finalScore, status, clientAnalyzer.getWindowTimeline(), clientAnalyzer.getFocusTimeline());
                    report.ReportGenerator.saveReport(sessionReport);
                    
                    System.out.println("Saved report for " + clientUuid + " with score: " + (Math.round(finalScore * 100)) + "%");
                } catch (Exception e) {
                    System.err.println("Error saving client report: " + e.getMessage());
                }
                analyzers.remove(clientUuid);
            }
        }
        
        if (state.scheduler != null && !state.scheduler.isShutdown()) {
            state.scheduler.shutdown();
        }
        
        if (orgId == 1) {
            currentSessionCode = "";
            analyzers.clear();
        }
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