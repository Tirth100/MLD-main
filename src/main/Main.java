package main;

import api.ApiServer;
import monitor.ActiveWindowTracker;
import service.AttentionAnalyzer;
import service.LeechDetector;
import report.Report;
import database.DatabaseHelper;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class Main {

    // Map to hold AttentionAnalyzers for each connected remote employee
    public static Map<String, AttentionAnalyzer> analyzers = new ConcurrentHashMap<>();
    
    private static ScheduledExecutorService scheduler;
    public static String currentSessionCode = "";

    public static void startMonitoring(String sessionCode) {
        if (scheduler == null || scheduler.isShutdown()) {
            currentSessionCode = sessionCode;
            analyzers.clear(); // Clear old clients
            
            scheduler = Executors.newScheduledThreadPool(1);
            
            // Note: In distributed architecture, local active window tracking is removed.
            // The API server will receive tracking ticks from remote DesktopClients via /api/track.
            
            System.out.println("Distributed monitoring session started for session " + sessionCode);
        }
    }

    public static void stopMonitoring() {
        System.out.println("\nMonitoring session stopped! Saving all client reports...");
        
        if (analyzers != null) {
            for (Map.Entry<String, AttentionAnalyzer> entry : analyzers.entrySet()) {
                try {
                    String clientUuid = entry.getKey();
                    AttentionAnalyzer clientAnalyzer = entry.getValue();
                    
                    double finalScore = clientAnalyzer.getAttentionScore();
                    String status = new LeechDetector().checkLeech(finalScore);
                    
                    Report sessionReport = new Report(clientUuid, currentSessionCode, clientAnalyzer.getTotalCount(), clientAnalyzer.getFocusedCount(),
                            clientAnalyzer.isWebcamActive(),
                            finalScore, status, clientAnalyzer.getWindowTimeline(), clientAnalyzer.getFocusTimeline());
                    report.ReportGenerator.saveReport(sessionReport);
                    
                    System.out.println("Saved report for " + clientUuid + " with score: " + (Math.round(finalScore * 100)) + "%");
                } catch (Exception e) {
                    System.err.println("Error saving client report: " + e.getMessage());
                }
            }
            analyzers.clear();
        }
        
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
            scheduler = null;
        }
        
        currentSessionCode = "";
        System.out.println("All sessions saved and monitoring reset.");
    }

    public static boolean isMonitoringActive() {
        return currentSessionCode != null && !currentSessionCode.isEmpty();
    }

    public static void main(String[] args) {

        System.out.println("Starting Meeting Leech Detector Backend...");

        // Initialize SQLite Database
        DatabaseHelper.initializeDatabase();

        // Start API Server
        try {
            ApiServer server = new ApiServer();
            server.startServer();
        } catch (IOException e) {
            System.err.println("Failed to start API Server: " + e.getMessage());
        }

        // Server started, waiting for manual start from dashboard
    }
}