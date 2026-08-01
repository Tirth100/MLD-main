package client;

import monitor.ActiveWindowTracker;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Scanner;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class DesktopClient {

    private static String serverUrl = "http://localhost:3000/api/track";
    private static String uuid = "";
    private static String sessionCode = "";
    private static ScheduledExecutorService scheduler;

    public static void main(String[] args) {
        System.out.println("==========================================");
        System.out.println("  Meeting Leech Detector - Desktop Client ");
        System.out.println("==========================================");

        Scanner scanner = new Scanner(System.in);
        
        System.out.print("Enter Central Server URL [default: http://localhost:3000]: ");
        String customUrl = scanner.nextLine().trim();
        if (!customUrl.isEmpty()) {
            if (!customUrl.startsWith("http://") && !customUrl.startsWith("https://")) {
                customUrl = "http://" + customUrl;
            }
            if (customUrl.endsWith("/")) customUrl = customUrl.substring(0, customUrl.length() - 1);
            if (!customUrl.endsWith("/api/track")) customUrl += "/api/track";
            serverUrl = customUrl;
        }
        
        System.out.print("Enter your UUID (from dashboard): ");
        uuid = scanner.nextLine().trim();
        
        System.out.print("Enter Session Code: ");
        sessionCode = scanner.nextLine().trim();

        System.out.println("\nStarting tracking for session " + sessionCode + "...");
        
        scheduler = Executors.newScheduledThreadPool(1);
        scheduler.scheduleAtFixedRate(() -> {
            try {
                String window = ActiveWindowTracker.getActiveWindowTitle();
                boolean webcam = ActiveWindowTracker.isWebcamActive();
                
                String payload = "{\"uuid\":\"" + uuid + "\", \"sessionCode\":\"" + sessionCode + "\", \"window\":\"" + window + "\", \"webcam\":" + webcam + "}";
                
                URL url = new URL(serverUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setDoOutput(true);
                
                try(OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                
                int code = conn.getResponseCode();
                System.out.println("[Sent Tracking Data] Window: " + window + " | Status: " + code);
                
            } catch (Exception e) {
                System.err.println("Error sending track data: " + e.getMessage());
            }
        }, 0, 10, TimeUnit.SECONDS);
    }
}
