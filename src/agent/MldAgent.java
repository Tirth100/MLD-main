package agent;

import monitor.ActiveWindowTracker;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public class MldAgent {

    private static String serverUrl = "https://mld-server.onrender.com";
    private static String uuid = "";
    private static String sessionCode = "";
    private static String employeeName = "";
    private static ScheduledExecutorService scheduler;
    private static ScheduledFuture<?> taskHandle;
    private static boolean isRunning = false;

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("   Meeting Leech Detector (MLD) - Desktop Agent  ");
        System.out.println("=================================================");

        Scanner scanner = new Scanner(System.in);

        // 1. Central Server URL Prompt
        System.out.print("Enter Central Server URL [default: https://mld-server.onrender.com]: ");
        String customUrl = scanner.nextLine().trim();
        if (!customUrl.isEmpty()) {
            if (!customUrl.startsWith("http://") && !customUrl.startsWith("https://")) {
                customUrl = "https://" + customUrl;
            }
            if (customUrl.endsWith("/")) customUrl = customUrl.substring(0, customUrl.length() - 1);
            serverUrl = customUrl;
        }

        // 2. Authentication Option (Email/Password Login vs Token)
        System.out.println("\nSelect Authentication Method:");
        System.out.println(" 1. Login using Website Credentials (Email & Password) [Recommended]");
        System.out.println(" 2. Enter User Token / UUID directly");
        System.out.print("Choice [1/2, default 1]: ");
        String authChoice = scanner.nextLine().trim();

        if ("2".equals(authChoice)) {
            System.out.print("Enter your User Token / UUID (from Employee Dashboard): ");
            uuid = scanner.nextLine().trim();
            while (uuid.isEmpty()) {
                System.out.print("User Token cannot be empty. Enter User Token: ");
                uuid = scanner.nextLine().trim();
            }
        } else {
            // Email & Password Agent Login
            boolean loggedIn = false;
            while (!loggedIn) {
                System.out.print("\nEnter Employee Email: ");
                String email = scanner.nextLine().trim();
                System.out.print("Enter Password: ");
                String password = scanner.nextLine().trim();

                System.out.println("[MLD Agent] Authenticating credentials with server...");
                LoginResponse loginRes = agentLogin(serverUrl, email, password);
                if (loginRes.success) {
                    uuid = loginRes.token;
                    employeeName = loginRes.name;
                    loggedIn = true;
                    System.out.println("\n=================================================");
                    System.out.println(" [AGENT LOGIN SUCCESSFUL] Welcome, " + employeeName + "!");
                    System.out.println(" User Token: " + uuid);
                    System.out.println("=================================================");
                } else {
                    System.err.println("[Login Failed] " + loginRes.message + " Please try again.");
                }
            }
        }

        // 3. Session Code Prompt
        System.out.print("\nEnter Session Code (e.g. MLD123): ");
        sessionCode = scanner.nextLine().trim().toUpperCase();
        while (sessionCode.isEmpty()) {
            System.out.print("Session Code cannot be empty. Enter Session Code: ");
            sessionCode = scanner.nextLine().trim().toUpperCase();
        }

        System.out.println("\n[MLD Agent] Validating session " + sessionCode + " with server...");

        // 4. Initial Join Validation
        boolean joined = joinSession(serverUrl, sessionCode, uuid);
        if (!joined) {
            System.err.println("\n[MLD Agent Error] Could not join session. Ensure session is active and belongs to your organization.");
            System.out.println("Press Enter to exit...");
            scanner.nextLine();
            System.exit(1);
        }

        System.out.println("=================================================");
        System.out.println(" 🟢 [AGENT CONNECTED & ACTIVE] Monitoring session... ");
        System.out.println(" Website Connection Status: Connected ");
        System.out.println(" Press Ctrl + C to exit anytime. ");
        System.out.println("=================================================\n");

        isRunning = true;
        scheduler = Executors.newSingleThreadScheduledExecutor();

        // 5. Monitoring Loop (Runs telemetry check every 10 seconds)
        taskHandle = scheduler.scheduleAtFixedRate(() -> {
            if (!isRunning) return;

            try {
                String windowTitle = ActiveWindowTracker.getActiveWindowTitle();
                boolean webcamActive = ActiveWindowTracker.isWebcamActive();
                int idleSeconds = 0; // Automatic window focus telemetry

                String payload = String.format(
                    "{\"uuid\":\"%s\", \"sessionCode\":\"%s\", \"window\":\"%s\", \"webcam\":%b, \"idle\":%d}",
                    escapeJson(uuid), escapeJson(sessionCode), escapeJson(windowTitle), webcamActive, idleSeconds
                );

                String endpoint = serverUrl + "/api/track";
                String responseJson = postHttpRequest(endpoint, payload);

                if (responseJson.contains("\"active\":false") || responseJson.contains("\"active\": false")) {
                    System.out.println("\n=================================================");
                    System.out.println(" [AGENT STOPPED] Session " + sessionCode + " ended by manager.");
                    System.out.println("=================================================");
                    shutdownAgent();
                } else {
                    System.out.println("[Telemetry Sent] Window: " + windowTitle + " | Camera: " + (webcamActive ? "ON" : "OFF"));
                }

            } catch (Exception e) {
                System.err.println("[Telemetry Warning] Connection retry: " + e.getMessage());
            }
        }, 0, 10, TimeUnit.SECONDS);
    }

    private static class LoginResponse {
        boolean success;
        String token;
        String name;
        String message;
        LoginResponse(boolean success, String token, String name, String message) {
            this.success = success; this.token = token; this.name = name; this.message = message;
        }
    }

    private static LoginResponse agentLogin(String baseUrl, String email, String password) {
        try {
            String payload = String.format("{\"email\":\"%s\", \"password\":\"%s\"}", escapeJson(email), escapeJson(password));
            String response = postHttpRequest(baseUrl + "/api/login", payload);
            if (response.contains("\"success\":true") || response.contains("\"success\": true")) {
                String token = extractJsonVal(response, "token");
                String name = extractJsonVal(response, "name");
                return new LoginResponse(true, token, name, "Login successful");
            } else {
                String msg = extractJsonVal(response, "message");
                return new LoginResponse(false, "", "", msg.isEmpty() ? "Invalid email or password" : msg);
            }
        } catch (Exception e) {
            return new LoginResponse(false, "", "", "Server connection error: " + e.getMessage());
        }
    }

    private static boolean joinSession(String baseUrl, String code, String tokenUuid) {
        try {
            String payload = String.format("{\"sessionCode\":\"%s\", \"uuid\":\"%s\"}", escapeJson(code), escapeJson(tokenUuid));
            String response = postHttpRequest(baseUrl + "/api/join", payload);
            if (response.contains("\"success\":true") || response.contains("\"success\": true")) {
                System.out.println("[MLD Agent] Join validated successfully!");
                return true;
            } else {
                System.err.println("[Server Response] " + response);
                return false;
            }
        } catch (Exception e) {
            System.err.println("[Join Error] " + e.getMessage());
            return false;
        }
    }

    private static String postHttpRequest(String urlString, String jsonBody) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(8000);
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
            os.write(input, 0, input.length);
        }

        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 400) ? conn.getInputStream() : conn.getErrorStream();
        if (is == null) return "{}";

        Scanner s = new Scanner(is, StandardCharsets.UTF_8).useDelimiter("\\A");
        return s.hasNext() ? s.next() : "{}";
    }

    private static String extractJsonVal(String json, String field) {
        if (json == null || field == null) return "";
        try {
            String pattern = "\"" + field + "\"";
            int idx = json.indexOf(pattern);
            if (idx == -1) return "";
            int colonIdx = json.indexOf(":", idx + pattern.length());
            if (colonIdx == -1) return "";
            int startQuote = json.indexOf("\"", colonIdx + 1);
            if (startQuote == -1) return "";
            int endQuote = json.indexOf("\"", startQuote + 1);
            if (endQuote == -1) return "";
            return json.substring(startQuote + 1, endQuote);
        } catch (Exception e) {
            return "";
        }
    }

    private static String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static synchronized void shutdownAgent() {
        isRunning = false;
        if (taskHandle != null) taskHandle.cancel(false);
        if (scheduler != null) scheduler.shutdown();
        System.exit(0);
    }
}
