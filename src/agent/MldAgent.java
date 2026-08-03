package agent;

import monitor.ActiveWindowTracker;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.Scanner;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class MldAgent {

    private static String serverUrl = "https://mld-server.onrender.com";
    private static String uuid = "";
    private static String employeeName = "";
    private static String currentSessionCode = "";
    private static boolean isMonitoring = false;
    private static final File CONFIG_FILE = new File(System.getProperty("user.home"), ".mld_agent.properties");

    public static void main(String[] args) {
        System.out.println("=================================================");
        System.out.println("   Meeting Leech Detector (MLD) - Desktop Agent  ");
        System.out.println("   [MLD Automated Background Client]      ");
        System.out.println("=================================================");

        Scanner scanner = new Scanner(System.in);

        // 1. Load Saved Configuration if available
        loadSavedConfig();

        // 2. Perform Initial Setup & Login if not configured
        if (uuid.isEmpty()) {
            System.out.print("\nEnter Central Server URL [default: https://mld-server.onrender.com]: ");
            String customUrl = scanner.nextLine().trim();
            if (!customUrl.isEmpty()) {
                if (!customUrl.startsWith("http://") && !customUrl.startsWith("https://")) {
                    customUrl = "https://" + customUrl;
                }
                if (customUrl.endsWith("/")) customUrl = customUrl.substring(0, customUrl.length() - 1);
                serverUrl = customUrl;
            }

            boolean loggedIn = false;
            while (!loggedIn) {
                System.out.println("\n--- One-Time Employee Login ---");
                System.out.print("Enter Employee Email: ");
                String email = scanner.nextLine().trim();
                System.out.print("Enter Password: ");
                String password = scanner.nextLine().trim();

                System.out.println("[MLD Agent] Authenticating with server...");
                LoginResponse loginRes = agentLogin(serverUrl, email, password);
                if (loginRes.success) {
                    uuid = loginRes.token;
                    employeeName = loginRes.name;
                    loggedIn = true;
                    saveConfig(serverUrl, uuid, email, employeeName);
                    System.out.println("\n=================================================");
                    System.out.println(" 🎉 MLD Agent Installed & Activated Successfully!");
                    System.out.println(" Welcome, " + employeeName + "!");
                    System.out.println("=================================================");
                } else {
                    System.err.println("[Login Failed] " + loginRes.message + " Please try again.");
                }
            }
        } else {
            System.out.println("\n=================================================");
            System.out.println(" 🟢 MLD Agent Connected & Active");
            System.out.println(" Welcome back, " + (employeeName.isEmpty() ? "Employee" : employeeName) + "!");
            System.out.println("=================================================");
        }

        System.out.println("\n=================================================");
        System.out.println(" 🤖 Agent Status: Running Silently in Background ");
        System.out.println(" Monitoring automatically starts when a session  ");
        System.out.println(" is joined, and stops when the session ends.     ");
        System.out.println("=================================================\n");

        ScheduledExecutorService backgroundScheduler = Executors.newSingleThreadScheduledExecutor();

        // 3. Automated Background Listener Loop (Runs every 5 seconds)
        backgroundScheduler.scheduleAtFixedRate(() -> {
            try {
                // Check if backend has an active session for organization
                SessionStatus status = getActiveSession(serverUrl, uuid);
                
                if (status.active && status.sessionCode != null && !status.sessionCode.isEmpty()) {
                    if (!isMonitoring || !status.sessionCode.equalsIgnoreCase(currentSessionCode)) {
                        currentSessionCode = status.sessionCode;
                        isMonitoring = true;
                        System.out.println("\n🟢 [ACTIVE SESSION DETECTED] Session Code: " + currentSessionCode);
                        System.out.println("   [MLD Agent] Auto-started monitoring telemetry!");
                    }

                    // Collect and transmit telemetry tick
                    sendTelemetryTick(serverUrl, currentSessionCode, uuid);

                } else {
                    if (isMonitoring) {
                        System.out.println("\n🔴 [SESSION ENDED] Session " + currentSessionCode + " ended by manager.");
                        System.out.println("   [MLD Agent] Monitoring paused. Standing by for next session...");
                        isMonitoring = false;
                        currentSessionCode = "";
                    }
                }
            } catch (Throwable t) {
                // Outer exception barrier prevents ScheduledExecutorService thread termination
                System.err.println("[MLD Agent Loop Warning] Telemetry cycle warning: " + t.getMessage());
            }
        }, 0, 5, TimeUnit.SECONDS);
    }

    private static void sendTelemetryTick(String baseUrl, String code, String userUuid) {
        try {
            String windowTitle = ActiveWindowTracker.getActiveWindowTitle();
            boolean webcamActive = ActiveWindowTracker.isWebcamActive();
            int idleSeconds = 0;

            String payload = String.format(
                "{\"uuid\":\"%s\", \"sessionCode\":\"%s\", \"window\":\"%s\", \"webcam\":%b, \"idle\":%d}",
                escapeJson(userUuid), escapeJson(code), escapeJson(windowTitle), webcamActive, idleSeconds
            );

            String endpoint = baseUrl + "/api/track";
            String responseJson = postHttpRequest(endpoint, payload);

            if (responseJson.contains("\"active\":false") || responseJson.contains("\"active\": false")) {
                isMonitoring = false;
                currentSessionCode = "";
                System.out.println("\n🔴 [SESSION ENDED] Monitoring paused by manager.");
            } else {
                System.out.println("[Telemetry Auto-Sent] Window: " + windowTitle + " | Camera: " + (webcamActive ? "ON" : "OFF"));
            }
        } catch (Exception e) {
            System.err.println("[Telemetry Connection Retry] " + e.getMessage());
        }
    }

    private static class SessionStatus {
        boolean active;
        String sessionCode;
        SessionStatus(boolean active, String sessionCode) {
            this.active = active; this.sessionCode = sessionCode;
        }
    }

    private static SessionStatus getActiveSession(String baseUrl, String userUuid) {
        try {
            String res = getHttpRequest(baseUrl + "/api/active-session?uuid=" + userUuid);
            boolean active = res.contains("\"active\":true") || res.contains("\"active\": true");
            String code = extractJsonVal(res, "sessionCode");
            return new SessionStatus(active, code);
        } catch (Exception e) {
            return new SessionStatus(false, "");
        }
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

    private static void loadSavedConfig() {
        if (!CONFIG_FILE.exists()) return;
        try (InputStream input = new FileInputStream(CONFIG_FILE)) {
            Properties prop = new Properties();
            prop.load(input);
            serverUrl = prop.getProperty("serverUrl", "https://mld-server.onrender.com");
            uuid = prop.getProperty("uuid", "");
            employeeName = prop.getProperty("employeeName", "");
        } catch (Exception ignored) {}
    }

    private static void saveConfig(String url, String userUuid, String email, String name) {
        try (OutputStream output = new FileOutputStream(CONFIG_FILE)) {
            Properties prop = new Properties();
            prop.setProperty("serverUrl", url);
            prop.setProperty("uuid", userUuid);
            prop.setProperty("email", email);
            prop.setProperty("employeeName", name);
            prop.store(output, "MLD Desktop Agent Configuration");
        } catch (Exception ignored) {}
    }

    private static String getHttpRequest(String urlString) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        int status = conn.getResponseCode();
        InputStream is = (status >= 200 && status < 400) ? conn.getInputStream() : conn.getErrorStream();
        if (is == null) return "{}";

        Scanner s = new Scanner(is, StandardCharsets.UTF_8).useDelimiter("\\A");
        return s.hasNext() ? s.next() : "{}";
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
}
