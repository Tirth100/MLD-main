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
import java.util.ArrayList;
import java.util.List;

import java.awt.AWTException;
import java.awt.Color;
import java.awt.Desktop;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.Image;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.SystemTray;
import java.awt.TrayIcon;
import java.awt.image.BufferedImage;
import java.net.URI;

public class MldAgent {

    private static String serverUrl = "https://mld-server.onrender.com";
    private static String uuid = "";
    private static String employeeName = "Employee";
    private static String currentSessionCode = "";
    private static boolean isMonitoring = false;
    private static final File CONFIG_FILE = new File(System.getProperty("user.home"), ".mld_agent.properties");
    private static TrayIcon trayIcon;
    private static int tickCounter = 0;
    
    // Offline Queue
    private static final List<String> offlineQueue = new ArrayList<>();

    public static void main(String[] args) {
        System.setProperty("https.protocols", "TLSv1.2,TLSv1.3");
        
        loadSavedConfig();
        
        // Handle Protocol Handler (mld-agent://link?token=XYZ)
        if (args.length > 0 && args[0].startsWith("mld-agent://link?token=")) {
            String newUuid = args[0].substring("mld-agent://link?token=".length()).trim();
            if (newUuid.endsWith("/")) newUuid = newUuid.substring(0, newUuid.length() - 1);
            uuid = newUuid;
            saveConfig(serverUrl, uuid, "", employeeName);
            System.out.println("Agent successfully linked with token: " + uuid);
        }

        initTray();

        ScheduledExecutorService backgroundScheduler = Executors.newScheduledThreadPool(2);

        // Heartbeat
        backgroundScheduler.scheduleAtFixedRate(() -> {
            loadSavedConfig(); // Reload config in case it was updated by another instance
            if (!uuid.isEmpty()) {
                try {
                    sendHeartbeat(serverUrl, uuid);
                } catch (Throwable t) {}
            }
        }, 0, 30, TimeUnit.SECONDS);

        // Telemetry Loop
        backgroundScheduler.scheduleAtFixedRate(() -> {
            if (uuid.isEmpty()) {
                updateTrayStatus(false, "Unlinked - Please link from dashboard");
                return;
            }
            try {
                SessionStatus status = getActiveSession(serverUrl, uuid);
                
                if (status.active && status.sessionCode != null && !status.sessionCode.isEmpty()) {
                    if (!isMonitoring || !status.sessionCode.equalsIgnoreCase(currentSessionCode)) {
                        currentSessionCode = status.sessionCode;
                        isMonitoring = true;
                        updateTrayStatus(true, currentSessionCode);
                        flushOfflineQueue(serverUrl, uuid);
                    }
                    sendTelemetryTick(serverUrl, currentSessionCode, uuid);
                } else {
                    if (isMonitoring) {
                        isMonitoring = false;
                        updateTrayStatus(false, "Standing by");
                        currentSessionCode = "";
                    }
                }
            } catch (Throwable t) {
                // Network error? Just cache if monitoring
                if (isMonitoring && !currentSessionCode.isEmpty()) {
                    cacheTelemetryTick(currentSessionCode, uuid);
                }
            }
        }, 0, 10, TimeUnit.SECONDS);
    }

    private static void initTray() {
        if (GraphicsEnvironment.isHeadless() || !SystemTray.isSupported()) return;
        try {
            SystemTray tray = SystemTray.getSystemTray();
            Image image = createTrayImage(Color.GRAY);
            PopupMenu popup = new PopupMenu();
            MenuItem openItem = new MenuItem("Open Dashboard");
            openItem.addActionListener(e -> openDashboard());
            MenuItem exitItem = new MenuItem("Exit Agent");
            exitItem.addActionListener(e -> System.exit(0));
            popup.add(openItem);
            popup.addSeparator();
            popup.add(exitItem);
            trayIcon = new TrayIcon(image, "MLD Agent", popup);
            trayIcon.setImageAutoSize(true);
            trayIcon.addActionListener(e -> openDashboard());
            tray.add(trayIcon);
        } catch (AWTException e) {}
    }

    private static Image createTrayImage(Color color) {
        BufferedImage image = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2 = image.createGraphics();
        g2.setColor(color);
        g2.fillOval(2, 2, 12, 12);
        g2.dispose();
        return image;
    }

    private static void openDashboard() {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(new URI("https://mld-main.onrender.com"));
            }
        } catch (Exception ex) {}
    }

    private static void updateTrayStatus(boolean monitoring, String message) {
        if (trayIcon == null) return;
        if (monitoring) {
            trayIcon.setImage(createTrayImage(Color.GREEN));
            trayIcon.setToolTip("MLD Agent: Monitoring (" + message + ")");
        } else {
            trayIcon.setImage(createTrayImage(Color.GRAY));
            trayIcon.setToolTip("MLD Agent: " + message);
        }
    }

    private static void sendHeartbeat(String baseUrl, String userUuid) throws Exception {
        String payload = "{\"uuid\": \"" + escapeJson(userUuid) + "\"}";
        postHttpRequest(baseUrl + "/api/heartbeat", payload, userUuid);
    }

    private static void cacheTelemetryTick(String code, String userUuid) {
        String windowTitle = ActiveWindowTracker.getActiveWindowTitle();
        boolean webcamActive = ActiveWindowTracker.isWebcamActive();
        int idleSeconds = ActiveWindowTracker.getIdleSeconds();
        String payload = new JsonObjectBuilder()
            .put("uuid", userUuid)
            .put("sessionCode", code)
            .put("window", windowTitle)
            .put("webcam", webcamActive)
            .put("idle", idleSeconds)
            .build();
        synchronized(offlineQueue) {
            offlineQueue.add(payload);
            if (offlineQueue.size() > 500) offlineQueue.remove(0); // limit memory
        }
    }

    private static void flushOfflineQueue(String baseUrl, String userUuid) {
        synchronized(offlineQueue) {
            List<String> toRemove = new ArrayList<>();
            for (String payload : offlineQueue) {
                try {
                    postHttpRequest(baseUrl + "/api/track", payload, userUuid);
                    toRemove.add(payload);
                } catch (Exception e) {
                    break; // stop flushing on first error
                }
            }
            offlineQueue.removeAll(toRemove);
        }
    }

    private static void sendTelemetryTick(String baseUrl, String code, String userUuid) throws Exception {
        String windowTitle = ActiveWindowTracker.getActiveWindowTitle();
        boolean webcamActive = ActiveWindowTracker.isWebcamActive();
        int idleSeconds = ActiveWindowTracker.getIdleSeconds();

        String payload = new JsonObjectBuilder()
            .put("uuid", userUuid)
            .put("sessionCode", code)
            .put("window", windowTitle)
            .put("webcam", webcamActive)
            .put("idle", idleSeconds)
            .build();

        String responseJson = postHttpRequest(baseUrl + "/api/track", payload, userUuid);

        if (responseJson.contains("\"active\":false") || responseJson.contains("\"active\": false")) {
            isMonitoring = false;
            currentSessionCode = "";
        }
    }

    private static class SessionStatus {
        boolean active;
        String sessionCode;
        SessionStatus(boolean active, String sessionCode) {
            this.active = active; this.sessionCode = sessionCode;
        }
    }

    private static SessionStatus getActiveSession(String baseUrl, String userUuid) throws Exception {
        String res = getHttpRequest(baseUrl + "/api/active-session?uuid=" + escapeJson(userUuid));
        boolean active = res.contains("\"active\":true") || res.contains("\"active\": true");
        String code = extractJsonVal(res, "sessionCode");
        return new SessionStatus(active, code);
    }

    private static void loadSavedConfig() {
        if (!CONFIG_FILE.exists()) return;
        try (InputStream input = new FileInputStream(CONFIG_FILE)) {
            Properties prop = new Properties();
            prop.load(input);
            serverUrl = prop.getProperty("serverUrl", "https://mld-server.onrender.com");
            uuid = prop.getProperty("uuid", "");
            employeeName = prop.getProperty("employeeName", "Employee");
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
            
            CONFIG_FILE.setReadable(false, false);
            CONFIG_FILE.setReadable(true, true);
            CONFIG_FILE.setWritable(false, false);
            CONFIG_FILE.setWritable(true, true);
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
        try (Scanner s = new Scanner(is, StandardCharsets.UTF_8).useDelimiter("\\A")) {
            return s.hasNext() ? s.next() : "{}";
        }
    }

    private static String postHttpRequest(String urlString, String jsonBody, String authToken) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
        if (authToken != null && !authToken.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + authToken);
        }
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
        try (Scanner s = new Scanner(is, StandardCharsets.UTF_8).useDelimiter("\\A")) {
            return s.hasNext() ? s.next() : "{}";
        }
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
    
    public static class JsonObjectBuilder {
        private StringBuilder sb = new StringBuilder("{");
        public JsonObjectBuilder put(String key, String value) {
            if (sb.length() > 1) sb.append(", ");
            sb.append("\"").append(key).append("\":\"").append(escapeJson(value)).append("\"");
            return this;
        }
        public JsonObjectBuilder put(String key, boolean value) {
            if (sb.length() > 1) sb.append(", ");
            sb.append("\"").append(key).append("\":").append(value);
            return this;
        }
        public JsonObjectBuilder put(String key, int value) {
            if (sb.length() > 1) sb.append(", ");
            sb.append("\"").append(key).append("\":").append(value);
            return this;
        }
        public String build() {
            return sb.append("}").toString();
        }
    }
}
