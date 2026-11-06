package api;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import main.Main;
import report.ReportGenerator;
import database.DatabaseHelper;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ApiServer {

    private static String extractJsonField(String json, String field) {
        if (json == null || field == null || json.isEmpty())
            return "";
        try {
            String pattern = "\"" + field + "\"";
            int idx = json.indexOf(pattern);
            if (idx == -1)
                return "";
            int colonIdx = json.indexOf(":", idx + pattern.length());
            if (colonIdx == -1)
                return "";

            String valSubstring = json.substring(colonIdx + 1).trim();
            if (valSubstring.startsWith("\"")) {
                StringBuilder sb = new StringBuilder();
                boolean escaped = false;
                for (int i = 1; i < valSubstring.length(); i++) {
                    char c = valSubstring.charAt(i);
                    if (escaped) {
                        sb.append(c);
                        escaped = false;
                    } else if (c == '\\') {
                        escaped = true;
                    } else if (c == '"') {
                        break;
                    } else {
                        sb.append(c);
                    }
                }
                return sb.toString();
            } else {
                int endIdx = 0;
                while (endIdx < valSubstring.length() &&
                        valSubstring.charAt(endIdx) != ',' &&
                        valSubstring.charAt(endIdx) != '}' &&
                        valSubstring.charAt(endIdx) != ']' &&
                        valSubstring.charAt(endIdx) != '\n' &&
                        valSubstring.charAt(endIdx) != '\r') {
                    endIdx++;
                }
                return valSubstring.substring(0, endIdx).trim();
            }
        } catch (Exception e) {
            return "";
        }
    }

    public static class AlertRecord {
        public String name;
        public String sessionCode;
        public int score;
        public String reason;
        public String time;

        public AlertRecord(String name, String sessionCode, int score, String reason, String time) {
            this.name = name;
            this.sessionCode = sessionCode;
            this.score = score;
            this.reason = reason;
            this.time = time;
        }

        public String toJson() {
            return String.format(
                    "{\"name\": \"%s\", \"sessionCode\": \"%s\", \"score\": %d, \"reason\": \"%s\", \"time\": \"%s\"}",
                    ApiServer.escapeJson(name),
                    ApiServer.escapeJson(sessionCode),
                    score,
                    ApiServer.escapeJson(reason),
                    ApiServer.escapeJson(time));
        }
    }

    private static final java.util.Map<Integer, java.util.List<AlertRecord>> orgAlerts = new java.util.concurrent.ConcurrentHashMap<>();

    public static void addOrgAlert(int orgId, String name, String sessionCode, int score, String reason, String time) {
        orgAlerts.computeIfAbsent(orgId, k -> new java.util.concurrent.CopyOnWriteArrayList<>())
                .add(new AlertRecord(name, sessionCode, score, reason, time));
    }

    public static void clearOrgAlerts(int orgId) {
        java.util.List<AlertRecord> list = orgAlerts.get(orgId);
        if (list != null) {
            list.clear();
        }
    }

    public static java.util.List<AlertRecord> getOrgAlerts(int orgId) {
        return orgAlerts.getOrDefault(orgId, java.util.Collections.emptyList());
    }

    private HttpServer serverInstance;

    public void startServer() throws IOException {
        int port = 3000;
        String portEnv = System.getenv("PORT");
        if (portEnv != null && !portEnv.isEmpty()) {
            try {
                port = Integer.parseInt(portEnv);
            } catch (NumberFormatException ignored) {
            }
        }
        startServer(port);
    }

    public void stopServer() {
        if (serverInstance != null) {
            serverInstance.stop(0);
        }
    }

    public void startServer(int port) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        this.serverInstance = server;

        server.createContext("/", new RootHandler());
        server.createContext("/download/mld-agent", new DownloadAgentHandler());
        server.createContext("/api/download-agent", new DownloadAgentHandler());
        server.createContext("/api/agent-status", new AgentStatusHandler());
        server.createContext("/api/heartbeat", new HeartbeatHandler());
        server.createContext("/api/engagement", new EngagementHandler());
        server.createContext("/api/alerts", new AlertsHandler());
        server.createContext("/api/analytics", new AnalyticsHandler());
        server.createContext("/api/employee-stats", new EmployeeStatsHandler());
        server.createContext("/api/export", new ExportHandler());
        server.createContext("/api/stop", new StopHandler());
        server.createContext("/api/start", new StartHandler());
        server.createContext("/api/join", new JoinHandler());
        server.createContext("/api/leave-session", new LeaveSessionHandler());
        server.createContext("/api/login", new LoginHandler());
        server.createContext("/api/send-invites", new SendInvitesHandler());
        server.createContext("/api/invites", new InvitesHandler());
        server.createContext("/api/signup-org", new OrgSignupHandler());
        server.createContext("/api/signup-emp", new EmpSignupHandler());
        server.createContext("/api/track", new TrackHandler());
        server.createContext("/api/active-session", new ActiveSessionHandler());
        server.createContext("/api/employees", new EmployeesHandler());
        server.createContext("/api/employees/remove", new RemoveEmployeeHandler());
        server.createContext("/api/profile", new ProfileHandler());
        server.createContext("/api/forgot-password", new ForgotPasswordHandler());
        server.createContext("/api/reset-password", new ResetPasswordHandler());
        server.createContext("/api/notifications", new NotificationsHandler());
        server.createContext("/api/google-login", new GoogleLoginHandler());
        server.createContext("/api/google-signup-org", new GoogleOrgSignupHandler());
        server.createContext("/api/google-signup-emp", new GoogleEmpSignupHandler());
        server.createContext("/api/logout", new LogoutHandler());
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        System.out.println("API Server started on port " + port + "!");
    }

    class LogoutHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendJsonError(exchange, 405, "Method Not Allowed");
                return;
            }
            String token = exchange.getRequestHeaders().getFirst("Authorization");
            if (token != null && token.startsWith("Bearer ")) {
                REVOKED_TOKENS.add(token.substring(7).trim());
            }
            sendResponse(exchange, "{\"success\": true, \"message\": \"Logged out successfully\"}");
        }
    }

    class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            String path = exchange.getRequestURI().getPath();
            if (path == null || path.equals("/")) {
                path = "/index.html";
            }

            java.io.File baseDir = new java.io.File(".").getCanonicalFile();
            java.io.File file = new java.io.File(baseDir, path).getCanonicalFile();

            // Only allow specific safe directories and root HTML files
            boolean isSafePath = path.startsWith("/css/") || path.startsWith("/js/") || path.startsWith("/assets/")
                    || path.endsWith(".html") || path.equals("/favicon.ico");

            if (isSafePath && file.exists() && !file.isDirectory()
                    && file.getPath().startsWith(baseDir.getPath() + java.io.File.separator)) {
                byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());
                String contentType = "text/html";
                if (path.endsWith(".css"))
                    contentType = "text/css";
                else if (path.endsWith(".js"))
                    contentType = "application/javascript";
                else if (path.endsWith(".svg"))
                    contentType = "image/svg+xml";
                else if (path.endsWith(".png"))
                    contentType = "image/png";
                else if (path.endsWith(".json"))
                    contentType = "application/json";
                else if (path.endsWith(".ico"))
                    contentType = "image/x-icon";

                exchange.getResponseHeaders().set("Content-Type", contentType);
                exchange.sendResponseHeaders(200, bytes.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(bytes);
                }
                return;
            }
            if (!isSafePath && !path.equals("/api")) {
                exchange.sendResponseHeaders(403, -1);
                return;
            }

            sendResponse(exchange,
                    "{\"status\": \"online\", \"service\": \"Meeting Leech Detector Central Server\", \"version\": \"1.0.0\"}");
        }
    }

    class DownloadAgentHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            try {
                java.io.File fileToServe = new java.io.File("MLD-Agent.exe");
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("frontend/public/MLD-Agent.exe");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("MLD-Agent.zip");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("MLD-Agent.jar");
                }
                if (fileToServe.exists()) {
                    byte[] bytes = java.nio.file.Files.readAllBytes(fileToServe.toPath());
                    exchange.getResponseHeaders().set("Content-Type", "application/octet-stream");
                    exchange.getResponseHeaders().set("Content-Disposition",
                            "attachment; filename=\"" + fileToServe.getName() + "\"");
                    exchange.sendResponseHeaders(200, bytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(bytes);
                    }
                } else {
                    String msg = "MLD Agent executable not found on server.";
                    exchange.sendResponseHeaders(404, msg.length());
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(msg.getBytes());
                    }
                }
            } catch (Exception e) {
                sendResponse(exchange, "{\"error\": \"Download failed\"}");
            }
        }
    }

    private static final Map<String, Long> lastAgentHeartbeats = new ConcurrentHashMap<>();
    private static final Map<String, String> activeJoinedSessions = new ConcurrentHashMap<>();

    public static Map<String, String> getActiveJoinedSessions() {
        return activeJoinedSessions;
    }

    class AgentStatusHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String query = exchange.getRequestURI().getQuery();
            String uuid = "";
            if (query != null && query.contains("uuid=")) {
                uuid = query.split("uuid=")[1].split("&")[0].trim();
            }

            String token = extractToken(exchange);
            boolean isAuthorized = (!token.isEmpty() && database.DatabaseHelper.getOrgIdFromToken(token) != -1)
                    || database.DatabaseHelper.isValidDeviceUuid(uuid);

            if (!isAuthorized) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }

            boolean isConnected = false;
            long now = System.currentTimeMillis();
            long twoMinutes = 2 * 60 * 1000L;

            if (!uuid.isEmpty()) {
                // 1. Check in-memory heartbeat first (fast path)
                String cleanUuid = uuid.toLowerCase().trim();
                Long lastPing = lastAgentHeartbeats.get(cleanUuid);
                if (lastPing != null && (now - lastPing) < twoMinutes) {
                    isConnected = true;
                }

                // 2. Check DB heartbeat (survives Render restarts)
                if (!isConnected) {
                    long dbPing = database.DatabaseHelper.getAgentLastHeartbeat(cleanUuid);
                    if (dbPing > 0 && (now - dbPing) < twoMinutes) {
                        isConnected = true;
                        // Restore into in-memory cache
                        lastAgentHeartbeats.put(cleanUuid, dbPing);
                    } else {
                        // Check if ANY device belonging to this user is connected
                        long anyDbPing = database.DatabaseHelper.getAnyDeviceLastHeartbeat(cleanUuid);
                        if (anyDbPing > 0 && (now - anyDbPing) < twoMinutes) {
                            isConnected = true;
                        }
                    }
                }

                // 3. Also check if analyzer is active (legacy support)
                if (!isConnected) {
                    if (Main.analyzers.containsKey(cleanUuid) || Main.analyzers.containsKey(uuid)) {
                        isConnected = true;
                    }
                }
            }

            String json = String.format("{\"connected\": %b, \"status\": \"%s\", \"uuid\": \"%s\"}",
                    isConnected, isConnected ? "Connected" : "Offline", escapeJson(uuid));
            sendResponse(exchange, json);
        }
    }

    class HeartbeatHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            try {
                java.io.InputStream is = exchange.getRequestBody();
                String body;
                try (java.util.Scanner s = new java.util.Scanner(is, java.nio.charset.StandardCharsets.UTF_8)
                        .useDelimiter("\\A")) {
                    body = s.hasNext() ? s.next() : "{}";
                }
                String uuid = extractJsonField(body, "uuid").trim();
                if (!uuid.isEmpty()) {
                    String cleanUuid = uuid.toLowerCase().trim();
                    lastAgentHeartbeats.put(cleanUuid, System.currentTimeMillis());
                    database.DatabaseHelper.updateAgentHeartbeat(cleanUuid);
                }
                sendResponse(exchange, "{\"ok\": true}");
            } catch (Exception e) {
                sendResponse(exchange, "{\"ok\": false}");
            }
        }
    }

    class ActiveSessionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String query = exchange.getRequestURI().getQuery();
            String userUuid = "";
            if (query != null && query.contains("uuid=")) {
                userUuid = query.split("uuid=")[1].split("&")[0].trim().toLowerCase();
            }

            String token = extractToken(exchange);
            boolean isAuthorized = (!token.isEmpty() && database.DatabaseHelper.getOrgIdFromToken(token) != -1)
                    || database.DatabaseHelper.isValidDeviceUuid(userUuid);

            if (!isAuthorized) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }
            if (!userUuid.isEmpty()) {
                lastAgentHeartbeats.put(userUuid, System.currentTimeMillis());
            }

            boolean active = false;
            String code = "";
            String orgActiveCode = "";
            if (token == null || token.isEmpty()) {
                token = userUuid;
            }
            String userRole = DatabaseHelper.getUserRoleFromToken(token);
            boolean isManager = "MANAGER".equals(userRole) || "ADMIN".equals(userRole);

            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId != -1 && Main.isMonitoringActive(orgId)) {
                orgActiveCode = Main.orgSessions.get(orgId).sessionCode;
                if (isManager) {
                    active = true;
                    code = orgActiveCode;
                } else if (!userUuid.isEmpty()) {
                    String cleanUuid = userUuid.toLowerCase();
                    boolean isJoined = false;
                    String joinedCode = activeJoinedSessions.get(cleanUuid);
                    if (joinedCode == null) joinedCode = activeJoinedSessions.get(userUuid);

                    if (joinedCode != null && joinedCode.equalsIgnoreCase(orgActiveCode)) {
                        isJoined = true;
                    } else {
                        // Check if another token belonging to the same user has joined
                        int uid = DatabaseHelper.getUserIdFromToken(userUuid);
                        if (uid != -1) {
                            for (Map.Entry<String, String> entry : activeJoinedSessions.entrySet()) {
                                if (entry.getValue().equalsIgnoreCase(orgActiveCode)) {
                                    int entryUid = DatabaseHelper.getUserIdFromToken(entry.getKey());
                                    if (entryUid == uid) {
                                        isJoined = true;
                                        // Auto-bind desktop agent token to session
                                        activeJoinedSessions.put(cleanUuid, orgActiveCode);
                                        // Share analyzer reference
                                        service.AttentionAnalyzer existing = Main.analyzers.get(entry.getKey().toLowerCase());
                                        if (existing == null) existing = Main.analyzers.get(entry.getKey());
                                        if (existing != null) {
                                            Main.analyzers.put(cleanUuid, existing);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (isJoined) {
                        active = true;
                        code = orgActiveCode;
                    }
                }
            }
            sendResponse(exchange, "{\"active\": " + active + ", \"sessionCode\": \"" + code + "\"}");
        }
    }

    class StopHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            int orgId = requireAuthenticated(exchange);
            if (orgId == -1)
                return;
            if (!requireManagerOrAdmin(exchange, token))
                return;
            try {
                if (!Main.isMonitoringActive(orgId)) {
                    sendResponse(exchange, "{\"success\": true, \"message\": \"No active session to stop.\"}");
                    return;
                }
                String sessionCode = Main.orgSessions.get(orgId).sessionCode;
                DatabaseHelper.invalidateSession(sessionCode);
                Main.stopMonitoring(orgId);
                activeJoinedSessions.entrySet()
                        .removeIf(entry -> DatabaseHelper.getOrgIdFromToken(entry.getKey()) == orgId);
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped.\"}");
            } catch (Exception e) {
                System.err.println("Stop error: " + e.getMessage());
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped with warning: "
                        + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    class LeaveSessionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String token = extractToken(exchange);
                String uuid = extractJsonField(body, "uuid").trim().toLowerCase();

                if (token == null || token.isEmpty() || !uuid.equals(token.toLowerCase())) {
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"Unauthorized session leave request.\"}");
                    return;
                }

                if (!uuid.isEmpty()) {
                    String cleanUuid = uuid.toLowerCase();
                    String sessionCode = activeJoinedSessions.get(cleanUuid);
                    if (sessionCode == null) sessionCode = activeJoinedSessions.get(uuid);

                    if (sessionCode != null) {
                        service.AttentionAnalyzer clientAnalyzer = Main.analyzers.get(cleanUuid);
                        if (clientAnalyzer == null) clientAnalyzer = Main.analyzers.get(uuid);

                        if (clientAnalyzer != null) {
                            try {
                                double finalScore = clientAnalyzer.getAttentionScore();
                                String status = new service.LeechDetector().checkLeech(finalScore);
                                report.Report sessionReport = new report.Report(cleanUuid, sessionCode,
                                        clientAnalyzer.getTotalCount(), clientAnalyzer.getFocusedCount(),
                                        clientAnalyzer.isWebcamActive(),
                                        finalScore, status, clientAnalyzer.getWindowTimeline(),
                                        clientAnalyzer.getFocusTimeline());
                                sessionReport.setJoinTime(clientAnalyzer.getJoinTimeFormatted());
                                report.ReportGenerator.saveReport(sessionReport);
                            } catch (Exception e) {
                                System.err.println("Error saving client report on leave: " + e.getMessage());
                            }
                        }
                    }
                    activeJoinedSessions.remove(cleanUuid);
                    activeJoinedSessions.remove(uuid);
                    Main.analyzers.remove(cleanUuid);
                    Main.analyzers.remove(uuid);
                }
                sendResponse(exchange, "{\"success\": true, \"message\": \"Left session successfully.\"}");
            } catch (Exception e) {
                sendResponse(exchange, "{\"success\": false, \"message\": \"Failed to leave session.\"}");
            }
        }
    }

    class StartHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            try {
                String token = extractToken(exchange);
                int orgId = requireAuthenticated(exchange);
                if (orgId == -1)
                    return;
                if (!requireManagerOrAdmin(exchange, token))
                    return;

                String sessionCode;
                synchronized (Main.orgSessions) {
                    if (Main.isMonitoringActive(orgId)) {
                        sessionCode = Main.orgSessions.get(orgId).sessionCode;
                        sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode
                                + "\", \"message\": \"Session already active with code " + sessionCode + "\"}");
                        return;
                    }
                    sessionCode = DatabaseHelper.createSession(token);
                    Main.startMonitoring(orgId, sessionCode);
                }
                sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode
                        + "\", \"message\": \"Session started successfully with code " + sessionCode + "\"}");
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, "{\"success\": false, \"message\": \"Failed to start session.\"}");
            }
        }
    }

    class JoinHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String sessionCode = extractJsonField(body, "sessionCode").trim().toUpperCase();
                String uuid = extractJsonField(body, "uuid").trim();
                String token = extractToken(exchange);

                if (token == null || token.isEmpty() || !uuid.equalsIgnoreCase(token)) {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Unauthorized join request.\"}");
                    return;
                }

                DatabaseHelper.JoinValidationResult validation = DatabaseHelper.validateSessionOrgAccess(sessionCode,
                        uuid);
                if (!validation.allowed) {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"" + validation.message + "\"}");
                    return;
                }

                if (DatabaseHelper.isValidSession(sessionCode)) {
                    activeJoinedSessions.put(uuid.toLowerCase(), sessionCode);
                    Main.analyzers.put(uuid.toLowerCase(), new service.AttentionAnalyzer());
                    DatabaseHelper.clearInvite(uuid, sessionCode);
                    sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode
                            + "\", \"message\": \"Joined session successfully.\"}");
                } else {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Session is not currently active.\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, "{\"success\": false, \"message\": \"Failed to join session.\"}");
            }
        }
    }

        private static final java.util.Map<String, Long> lastAiAlertTimes = new java.util.concurrent.ConcurrentHashMap<>();

    private void processAiSignals(int orgId, String uuid, String sessionCode, String body, service.AttentionAnalyzer analyzer) {
        try {
            int sigStart = body.indexOf("\"aiSignals\":");
            if (sigStart < 0) return;
            int arrStart = body.indexOf("[", sigStart);
            int arrEnd = body.lastIndexOf("]");
            if (arrStart < 0 || arrEnd <= arrStart) return;

            String inner = body.substring(arrStart + 1, arrEnd).trim();
            if (inner.isEmpty()) return;

            int idx = 0;
            while (idx < inner.length()) {
                int objStart = inner.indexOf("{", idx);
                if (objStart < 0) break;
                int objEnd = inner.indexOf("}", objStart);
                if (objEnd < 0) break;

                String objStr = inner.substring(objStart, objEnd + 1);
                idx = objEnd + 1;

                String type = extractJsonField(objStr, "type");
                String proc = extractJsonField(objStr, "process");
                String confidence = extractJsonField(objStr, "confidence");
                String reason = extractJsonField(objStr, "reason");

                if ("HIGH".equalsIgnoreCase(confidence) || "MEDIUM".equalsIgnoreCase(confidence)) {
                    analyzer.recordAiSignal(type + ": " + reason);

                    String throttleKey = uuid + "_" + type;
                    long now = System.currentTimeMillis();
                    Long lastTime = lastAiAlertTimes.get(throttleKey);

                    if (lastTime == null || (now - lastTime) > 60000) {
                        lastAiAlertTimes.put(throttleKey, now);

                        String empName = DatabaseHelper.getEmployeeNameByUuid(uuid);
                        if (empName == null || empName.isBlank()) {
                            empName = "Participant (" + (uuid.length() > 6 ? uuid.substring(0, 6) : uuid) + ")";
                        }

                        int scorePct = (int) Math.round(analyzer.getAttentionScore() * 100);
                        String alertReason = "Potential unauthorized assistance — review required: " + reason + " (" + confidence + " Confidence)";
                        String timeStr = new java.text.SimpleDateFormat("hh:mm:ss a").format(new java.util.Date());

                        addOrgAlert(orgId, empName, sessionCode, scorePct, alertReason, timeStr);
                        System.out.println("[AI Alert] " + alertReason + " for " + empName);
                    }
                }
            }
        } catch (Exception ex) {
            System.err.println("Error processing AI assistance signals: " + ex.getMessage());
        }
    }

    class TrackHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if ("POST".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                try {
                    java.io.InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());

                    String token = extractToken(exchange);
                    String uuid = extractJsonField(body, "uuid").trim();

                    if (token == null || token.isEmpty() || !uuid.equalsIgnoreCase(token)) {
                        sendResponse(exchange,
                                "{\"success\": false, \"active\": false, \"message\": \"Unauthorized track request.\"}");
                        return;
                    }

                    String sessionCode = extractJsonField(body, "sessionCode").trim();
                    String window = extractJsonField(body, "window");
                    int idle = 0;
                    if (body.contains("\"idle\"")) {
                        try {
                            String idleStr = body.split("\"idle\"")[1].split(":")[1].split("[,}]")[0].trim();
                            idle = Integer.parseInt(idleStr);
                        } catch (Exception ex) {
                        }
                    }
                    boolean webcam = body.contains("\"webcam\":true") || body.contains("\"webcam\": true");

                    if (!uuid.isEmpty()) {
                        lastAgentHeartbeats.put(uuid.toLowerCase(), System.currentTimeMillis());
                    }

                    int orgId = DatabaseHelper.getOrgIdFromToken(uuid);
                    if (orgId != -1 && Main.isMonitoringActive(orgId)) {
                        String cleanUuid = uuid.toLowerCase();
                        String currentSession = Main.orgSessions.get(orgId).sessionCode;

                        String userRole = DatabaseHelper.getUserRoleFromToken(uuid);
                        boolean isManager = "MANAGER".equalsIgnoreCase(userRole) || "ADMIN".equalsIgnoreCase(userRole);
                        boolean isJoined = activeJoinedSessions.containsKey(cleanUuid)
                                || activeJoinedSessions.containsKey(uuid);

                        int trackUid = DatabaseHelper.getUserIdFromToken(uuid);
                        String joinedTokenForUser = null;
                        if (!isJoined && trackUid != -1) {
                            for (Map.Entry<String, String> entry : activeJoinedSessions.entrySet()) {
                                if (entry.getValue().equalsIgnoreCase(currentSession) &&
                                        DatabaseHelper.getUserIdFromToken(entry.getKey()) == trackUid) {
                                    isJoined = true;
                                    joinedTokenForUser = entry.getKey();
                                    activeJoinedSessions.put(cleanUuid, currentSession);
                                    break;
                                }
                            }
                        }

                        if (!isManager && !isJoined) {
                            sendResponse(exchange, "{\"success\": true, \"active\": false, \"message\": \"Standby\"}");
                            return;
                        }

                        service.AttentionAnalyzer analyzer = Main.analyzers.get(cleanUuid);
                        if (analyzer == null && joinedTokenForUser != null) {
                            analyzer = Main.analyzers.get(joinedTokenForUser.toLowerCase());
                            if (analyzer == null) {
                                analyzer = Main.analyzers.get(joinedTokenForUser);
                            }
                        }
                        if (analyzer == null) {
                            analyzer = new service.AttentionAnalyzer();
                        }
                        Main.analyzers.put(cleanUuid, analyzer);
                        if (joinedTokenForUser != null) {
                            Main.analyzers.put(joinedTokenForUser.toLowerCase(), analyzer);
                        }

                        analyzer.analyzeWindow(window, webcam, idle);

                        String activeSessionCode = sessionCode;
                        if (activeSessionCode == null || activeSessionCode.isEmpty()) {
                            activeSessionCode = Main.orgSessions.get(orgId).sessionCode;
                        }

                        if (body.contains("\"aiSignals\"")) {
                            processAiSignals(orgId, cleanUuid, activeSessionCode, body, analyzer);
                        }

                        // Note: intermediate ticks tracked in-memory only; final report committed upon
                        // session stop or leave
                        sendResponse(exchange, "{\"success\": true, \"active\": true}");
                    } else {
                        sendResponse(exchange,
                                "{\"success\": true, \"active\": false, \"message\": \"Session stopped by manager.\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Track error: " + e.getMessage());
                    sendResponse(exchange, "{\"success\": false, \"active\": false, \"message\": \""
                            + escapeJson(e.getMessage()) + "\"}");
                }
            }
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        String allowedOrigin = "http://localhost:3000"; // default safe fallback

        if (origin != null && (origin.equals("http://localhost:3000") ||
                origin.equals("http://localhost:8000") ||
                origin.equals("https://mld-server.onrender.com") ||
                origin.equals("https://mld-main.onrender.com"))) {
            allowedOrigin = origin;
        }

        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", allowedOrigin);
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers",
                "Content-Type, Authorization, Bypass-Tunnel-Reminder, Cache-Control");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "86400");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().set("X-Frame-Options", "DENY");
        exchange.getResponseHeaders().set("Referrer-Policy", "strict-origin-when-cross-origin");
    }

    private void sendResponse(HttpExchange exchange, String response) throws IOException {
        addCorsHeaders(exchange);
        if ("OPTIONS".equals(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }
        byte[] bytes = response.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static String getEmployeeNameByUuid(String uuid) {
        return DatabaseHelper.getEmployeeNameByUuid(uuid);
    }

    class EngagementHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            addCorsHeaders(exchange);
            if (!"GET".equals(exchange.getRequestMethod()) && !"DELETE".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String token = extractToken(exchange);
            int orgId = requireAuthenticated(exchange);
            if (orgId == -1)
                return;

            if ("DELETE".equals(exchange.getRequestMethod())) {
                if (!requireManagerOrAdmin(exchange, token))
                    return;
                String query = exchange.getRequestURI().getQuery();
                int reportId = -1;
                String timestamp = null;
                String sessionCode = null;
                if (query != null && !query.isBlank()) {
                    for (String part : query.split("&")) {
                        String[] kv = part.split("=", 2);
                        if (kv.length == 2) {
                            String key = kv[0].trim();
                            String val = java.net.URLDecoder.decode(kv[1].trim(),
                                    java.nio.charset.StandardCharsets.UTF_8);
                            if ("id".equalsIgnoreCase(key)) {
                                try {
                                    reportId = Integer.parseInt(val);
                                } catch (Exception ignored) {
                                }
                            } else if ("timestamp".equalsIgnoreCase(key)) {
                                timestamp = val;
                            } else if ("sessionCode".equalsIgnoreCase(key)) {
                                sessionCode = val;
                            }
                        }
                    }
                }

                if (reportId == -1 && (timestamp == null || timestamp.isBlank())) {
                    sendJsonError(exchange, 400, "Missing report identifier (id or timestamp required).");
                    return;
                }

                boolean deleted = ReportGenerator.deleteReportForOrganization(reportId, timestamp, sessionCode, orgId);
                if (deleted) {
                    sendResponse(exchange, "{\"success\": true, \"message\": \"Report deleted successfully.\"}");
                } else {
                    sendJsonError(exchange, 404, "Report not found or access denied.");
                }
                return;
            }

            // Retrieve actual JSON Array generated strictly from local file storage
            // removing all placeholders
            StringBuilder combinedJson = new StringBuilder("[");
            String role = DatabaseHelper.getUserRoleFromToken(token);
            int userId = DatabaseHelper.getUserIdFromToken(token);
            String userName = DatabaseHelper.getUserNameFromToken(token);
            boolean isEmployee = "EMPLOYEE".equalsIgnoreCase(role);

            int filterUserId = isEmployee ? userId : -1;
            String filterName = isEmployee ? userName : null;

            String localReports = ReportGenerator.getAllReportsAsJsonArray(orgId, filterUserId, filterName);
            if (localReports.length() > 2) {
                combinedJson.append(localReports.substring(1, localReports.length() - 1));
            }

            // Inject the currently active live session into the array natively
            if (Main.isMonitoringActive(orgId)) {
                String currentSession = Main.orgSessions.get(orgId).sessionCode;
                java.util.Set<String> processedUsersInLive = new java.util.HashSet<>();

                for (java.util.Map.Entry<String, String> joined : activeJoinedSessions.entrySet()) {
                    String uuid = joined.getKey();
                    String joinedCode = joined.getValue();
                    if (joinedCode == null || !joinedCode.equalsIgnoreCase(currentSession))
                        continue;

                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId)
                        continue;

                    String empName = getEmployeeNameByUuid(uuid);
                    if (empName == null || empName.contains("(MANAGER)") || empName.contains("(ADMIN)"))
                        continue; // Skip managers/admins from employee engagement table

                    int uId = DatabaseHelper.getUserIdFromToken(uuid);
                    String userKey = (uId > 0) ? ("uid_" + uId) : empName.toLowerCase();
                    if (!processedUsersInLive.add(userKey)) {
                        continue; // Don't duplicate if both web token and agent token joined for same employee
                    }

                    if (isEmployee) {
                        if (!uuid.equalsIgnoreCase(token) && uId != userId) {
                            continue;
                        }
                    }

                    service.AttentionAnalyzer analyzer = Main.analyzers.get(uuid.toLowerCase());
                    if (analyzer == null) {
                        analyzer = Main.analyzers.get(uuid);
                    }
                    if (analyzer == null) {
                        analyzer = new service.AttentionAnalyzer();
                        Main.analyzers.put(uuid.toLowerCase(), analyzer);
                    }

                    int totalCount = analyzer.getTotalCount();
                    int focusedCount = analyzer.getFocusedCount();
                    int scorePct = totalCount > 0 ? (int) Math.round(((double) focusedCount / totalCount) * 100) : 100;
                    String stat = totalCount > 0 ? new service.LeechDetector().checkLeech((double) focusedCount / totalCount) : "Engaged";
                    String lastWin = analyzer.getWindowTimeline().isEmpty() ? "Meeting Workspace"
                            : analyzer.getWindowTimeline().get(analyzer.getWindowTimeline().size() - 1);

                    String liveJson = String.format(
                            "{\"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"activeWindow\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"webcamActive\": %b, \"idleSeconds\": %d, \"durationSeconds\": %d, \"sessionCode\": \"%s\", \"timestamp\": \"Live Session\", \"joinTime\": \"%s\", \"isLive\": true}",
                            escapeJson(empName), scorePct, stat, lastWin, totalCount,
                            focusedCount, analyzer.isWebcamActive(), analyzer.getIdleSeconds(),
                            analyzer.getDurationSeconds(), currentSession,
                            analyzer.getJoinTimeFormatted());

                    if (combinedJson.length() > 1)
                        combinedJson.append(", ");
                    combinedJson.append(liveJson);
                }
            }

            combinedJson.append("]");
            sendResponse(exchange, combinedJson.toString());
        }
    }

    class AlertsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }

            String token = extractToken(exchange);
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }

            if ("DELETE".equals(exchange.getRequestMethod())) {
                clearOrgAlerts(orgId);
                sendResponse(exchange, "{\"success\": true, \"message\": \"Alerts cleared.\"}");
                return;
            }

            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            StringBuilder combinedJson = new StringBuilder("[");
            boolean first = true;

            if (Main.isMonitoringActive(orgId)) {
                // Live meeting in progress: stream real-time focus alerts under 50%
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId)
                        continue;

                    service.AttentionAnalyzer analyzer = entry.getValue();
                    if (analyzer.getTotalCount() > 0) {
                        double score = analyzer.getAttentionScore();
                        if (score < 0.5) {
                            if (!first)
                                combinedJson.append(",");
                            String empName = getEmployeeNameByUuid(uuid);
                            int scorePct = (int) Math.round(score * 100);
                            combinedJson.append(String.format(
                                    "{\"name\": \"%s\", \"sessionCode\": \"%s\", \"score\": %d, \"reason\": \"Live low focus score of %d%% (< 50%% threshold) detected\", \"time\": \"Current Live Session\"}",
                                    escapeJson(empName), Main.orgSessions.get(orgId).sessionCode, scorePct, scorePct));
                            first = false;
                        }
                    }
                }
            }
            // Stream stored alerts (e.g. AI assistance alerts and end-of-session alerts)
            java.util.List<AlertRecord> storedAlerts = getOrgAlerts(orgId);
            if (storedAlerts != null && !storedAlerts.isEmpty()) {
                for (AlertRecord alert : storedAlerts) {
                    if (!first)
                        combinedJson.append(",");
                    combinedJson.append(alert.toJson());
                    first = false;
                }
            }

            combinedJson.append("]");
            sendResponse(exchange, combinedJson.toString());
        }
    }

    class AnalyticsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId == -1) {
                exchange.sendResponseHeaders(401, -1);
                return;
            }

            int focused = 0;
            int total = 0;
            java.util.List<Integer> history = new java.util.ArrayList<>();

            if (Main.isMonitoringActive(orgId)) {
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId)
                        continue;

                    service.AttentionAnalyzer analyzer = entry.getValue();
                    focused += analyzer.getFocusedCount();
                    total += analyzer.getTotalCount();
                    if (history.isEmpty() && !analyzer.getFocusHistory().isEmpty()) {
                        history = analyzer.getFocusHistory(); // use first available history
                    }
                }
            }

            int unfocused = total - focused;

            String historyData = history.isEmpty() ? "[]" : history.toString();
            String timeLabels = "[";
            for (int i = 0; i < history.size(); i++) {
                timeLabels += "\"" + (i * 10) + "s\"" + (i < history.size() - 1 ? "," : "");
            }
            timeLabels += "]";

            String json = "{\n" +
                    "\"windowFocus\": [" + focused + ", " + unfocused + ", 0],\n" +
                    "\"chatActivity\": [0, 0, 0, 0, 0, 0],\n" +
                    "\"speakingTime\": " + timeLabels + ",\n" +
                    "\"speakingData\": " + historyData + "\n" +
                    "}";
            sendResponse(exchange, json);
        }
    }

    class EmployeeStatsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String token = extractToken(exchange);
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (token.isEmpty() || orgId == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }

            double sumScore = 0;
            int count = 0;
            if (Main.isMonitoringActive(orgId)) {
                service.AttentionAnalyzer analyzer = Main.analyzers.get(token.toLowerCase());
                if (analyzer != null && analyzer.getTotalCount() > 0) {
                    sumScore += analyzer.getAttentionScore();
                    count++;
                }
            }
            int score = count > 0 ? (int) Math.round((sumScore / count) * 100) : 0;
            int focus = count > 0 ? score : 0;
            String status = (orgId != -1 && Main.isMonitoringActive(orgId))
                    ? "Active Monitoring Session (" + Main.orgSessions.get(orgId).sessionCode + ")"
                    : "Session Stopped";
            String json = "{\n" +
                    "\"score\": " + score + ",\n" +
                    "\"focus\": " + focus + ",\n" +
                    "\"chat\": 0,\n" + // Set unused dimensions to 0 to prevent displaying fake data
                    "\"speaking\": 0,\n" +
                    "\"meetingStatus\": \"" + status + "\"\n" +
                    "}";
            sendResponse(exchange, json);
        }
    }

    class LoginHandler implements HttpHandler {
        private final java.util.concurrent.ConcurrentHashMap<String, Integer> loginAttempts = new java.util.concurrent.ConcurrentHashMap<>();
        private final java.util.concurrent.ConcurrentHashMap<String, Long> loginLockouts = new java.util.concurrent.ConcurrentHashMap<>();

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }

            String ip = exchange.getRemoteAddress().getAddress().getHostAddress();
            long now = System.currentTimeMillis();
            if (loginLockouts.containsKey(ip) && now - loginLockouts.get(ip) < 60000) {
                exchange.sendResponseHeaders(429, -1); // 429 Too Many Requests
                exchange.close();
                return;
            } else if (loginLockouts.containsKey(ip)) {
                loginLockouts.remove(ip);
                loginAttempts.remove(ip);
            }

            InputStream is = exchange.getRequestBody();
            String body = new String(is.readAllBytes());
            try {
                String email = extractJsonField(body, "email").trim();
                String password = extractJsonField(body, "password").trim();

                if (!InputValidator.isValidEmail(email) || password.isBlank()) {
                    sendJsonError(exchange, 400, "Invalid email or missing password format.");
                    return;
                }

                DatabaseHelper.LoginResult res = DatabaseHelper.login(email, password);
                if (res.success) {
                    loginAttempts.remove(ip);
                    sendResponse(exchange, "{\"success\": true, \"token\": \"" + res.token + "\", \"role\": \""
                            + res.role + "\", \"name\": \"" + escapeJson(res.name) + "\"}");
                } else {
                    int attempts = loginAttempts.getOrDefault(ip, 0) + 1;
                    loginAttempts.put(ip, attempts);
                    if (attempts >= 5) {
                        loginLockouts.put(ip, System.currentTimeMillis());
                        sendResponse(exchange,
                                "{\"success\": false, \"message\": \"Too many login attempts. Please wait 1 minute.\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                }
            } catch (Exception e) {
                System.err.println("Login error: " + e.getMessage());
                sendResponse(exchange,
                        "{\"success\": false, \"message\": \"Login failed: " + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    class OrgSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String orgName = extractJsonField(body, "orgName");
                    if (orgName == null || orgName.isBlank()) {
                        orgName = extractJsonField(body, "name");
                    }
                    String managerName = extractJsonField(body, "managerName");
                    String email = extractJsonField(body, "email") != null ? extractJsonField(body, "email").trim()
                            : "";
                    String password = extractJsonField(body, "password") != null
                            ? extractJsonField(body, "password").trim()
                            : "";

                    if (!InputValidator.isValidEmail(email)) {
                        sendJsonError(exchange, 400, "Invalid email address format.");
                        return;
                    }
                    if (!InputValidator.isValidPassword(password)) {
                        sendJsonError(exchange, 400, "Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number.");
                        return;
                    }
                    if (!InputValidator.isValidName(orgName)) {
                        sendJsonError(exchange, 400,
                                "Invalid organization name. Only letters, spaces, hyphens, and apostrophes allowed.");
                        return;
                    }

                    DatabaseHelper.OrgSignupResult res = DatabaseHelper.signupOrg(orgName, managerName, email,
                            password);
                    if (res.success) {
                        sendResponse(exchange, "{\"success\": true, \"orgCode\": \"" + res.orgCode
                                + "\", \"message\": \"" + res.message + "\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Org Signup error: " + e.getMessage());
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"Signup failed: " + escapeJson(e.getMessage()) + "\"}");
                }
            }
        }
    }

    class EmpSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String name = extractJsonField(body, "name");
                    String email = extractJsonField(body, "email").trim();
                    String password = extractJsonField(body, "password").trim();
                    String orgCode = extractJsonField(body, "orgCode").trim();

                    if (!InputValidator.isValidEmail(email) || !InputValidator.isValidPassword(password)
                            || !InputValidator.isValidName(name)) {
                        sendJsonError(exchange, 400,
                                "Invalid input formats. Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number.");
                        return;
                    }

                    DatabaseHelper.EmpSignupResult res = DatabaseHelper.signupEmp(name, email, password, orgCode);
                    if (res.success) {
                        sendResponse(exchange, "{\"success\": true, \"message\": \"" + res.message + "\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Emp Signup error: " + e.getMessage());
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"Signup failed: " + escapeJson(e.getMessage()) + "\"}");
                }
            }
        }
    }

    class ExportHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            addCorsHeaders(exchange);
            String token = extractToken(exchange);
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId == -1) {
                exchange.sendResponseHeaders(401, -1);
                return;
            }

            exchange.getResponseHeaders().add("Content-Type", "text/csv");
            exchange.getResponseHeaders().add("Content-Disposition", "attachment; filename=\"report.csv\"");

            // Fetch aggregated reports via local API call to include remote employees
            String jsonArray = "[]";
            try {
                URL url = new URL("http://localhost:3000/api/engagement");
                HttpURLConnection con = (HttpURLConnection) url.openConnection();
                con.setRequestMethod("GET");
                con.setRequestProperty("Authorization", "Bearer " + token);
                if (con.getResponseCode() == 200) {
                    jsonArray = new String(con.getInputStream().readAllBytes());
                }
            } catch (Exception e) {
                jsonArray = ReportGenerator.getAllReportsAsJsonArray(orgId);
            }

            // Generate basic CSV dynamically (Hack method: splitting JSON without Jackson
            // for speed since it's raw format)
            String csv = "Name,Role,Score,Status,TotalChecks,FocusedChecks,Timestamp,ActivitySummary\n";
            String[] reports = jsonArray.split("\"name\": \"");
            for (int i = 1; i < reports.length; i++) {
                String block = reports[i];
                try {
                    String name = block.split("\"", 2)[0];
                    String scoreStr = block.split("\"score\": ")[1].split(",")[0].trim();
                    String statusStr = block.split("\"status\": \"")[1].split("\"", 2)[0];
                    String totCheck = block.split("\"totalChecks\": ")[1].split(",")[0].trim();
                    String focCheck = block.split("\"focusedChecks\": ")[1].split(",")[0].trim();
                    String timestamp = block.split("\"timestamp\": \"")[1].split("\"", 2)[0];
                    String timeline = "";
                    if (block.contains("\"timeline\": [")) {
                        String extracted = block.split("\"timeline\": \\[")[1];
                        int endIdx = extracted.lastIndexOf("]}");
                        if (endIdx != -1) {
                            extracted = extracted.substring(0, endIdx);
                        } else {
                            endIdx = extracted.lastIndexOf("]");
                            if (endIdx != -1)
                                extracted = extracted.substring(0, endIdx);
                        }
                        timeline = extracted.replace("\r", "").replace("\n", "").replace(",", ";").replace("\"", "'")
                                .replace("  ", " ");
                    }
                    csv += csvEscape(name) + ",Employee," + csvEscape(scoreStr) + "," + csvEscape(statusStr) + ","
                            + csvEscape(totCheck) + "," + csvEscape(focCheck) + "," + csvEscape(timestamp) + ","
                            + csvEscape(timeline) + "\n";
                } catch (Exception e) {
                    System.err.println("Error parsing report block for export: " + e.getMessage());
                }
            }

            exchange.sendResponseHeaders(200, csv.getBytes().length);
            OutputStream os = exchange.getResponseBody();
            os.write(csv.getBytes());
            os.close();
        }
    }

    private static final java.util.Set<String> REVOKED_TOKENS = java.util.concurrent.ConcurrentHashMap.newKeySet();

    private String extractToken(HttpExchange exchange) {
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7).trim();
            if (REVOKED_TOKENS.contains(token))
                return "";
            return token;
        }
        return "";
    }

    private int requireAuthenticated(HttpExchange exchange) throws IOException {
        String token = extractToken(exchange);
        if (token == null || token.isBlank()) {
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
            return -1;
        }
        int orgId = DatabaseHelper.getOrgIdFromToken(token);
        if (orgId == -1) {
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
            return -1;
        }
        return orgId;
    }

    private boolean requireManagerOrAdmin(HttpExchange exchange, String token) throws IOException {
        if (token == null || token.isBlank()) {
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
            return false;
        }
        int orgId = DatabaseHelper.getOrgIdFromToken(token);
        if (orgId == -1) {
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
            return false;
        }
        String role = DatabaseHelper.getUserRoleFromToken(token);
        if (!"ADMIN".equalsIgnoreCase(role) && !"MANAGER".equalsIgnoreCase(role)) {
            exchange.sendResponseHeaders(403, -1);
            exchange.close();
            return false;
        }
        return true;
    }

    private void sendJsonError(HttpExchange exchange, int status, String message) throws IOException {
        String json = "{\"success\": false, \"message\": \"" + escapeJson(message) + "\"}";
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        byte[] bytes = json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static String escapeJson(String input) {
        if (input == null)
            return "";
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    // CSV export safety: prevents formula/DDE injection (CWE-1236) when a cell
    // value
    // starting with =, +, -, or @ gets opened in Excel/Sheets/LibreOffice, and
    // follows
    // RFC 4180 quoting so commas/quotes/newlines inside a field (e.g. an employee
    // name)
    // don't corrupt the column structure.
    private static String csvEscape(String value) {
        if (value == null)
            value = "";
        if (!value.isEmpty()) {
            char first = value.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
                value = "'" + value;
            }
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            value = "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    class EmployeesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (token.isEmpty() || DatabaseHelper.getOrgIdFromToken(token) == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }
            String json = DatabaseHelper.getEmployeesByManagerToken(token);
            sendResponse(exchange, json);
        }
    }

    class RemoveEmployeeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (token.isEmpty() || DatabaseHelper.getOrgIdFromToken(token) == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }
            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String idStr = extractJsonField(body, "id");
                if (idStr.isEmpty())
                    idStr = "0";
                boolean success = DatabaseHelper.removeEmployee(token, Integer.parseInt(idStr));
                sendResponse(exchange, "{\"success\": " + success + (success ? "" : ", \"message\": \"Failed to remove participant. Please check permissions or database constraint.\"") + "}");
            } catch (Exception e) {
                sendResponse(exchange, "{\"success\": false, \"message\": \"" + escapeJson(e.getMessage()) + "\"}");
            }
        }
    }

    class ProfileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (token.isEmpty() || DatabaseHelper.getOrgIdFromToken(token) == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }
            String json = DatabaseHelper.getManagerProfile(token);
            sendResponse(exchange, json);
        }
    }

    class ForgotPasswordHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendJsonError(exchange, 405, "Method Not Allowed");
                return;
            }
            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String email = extractJsonField(body, "email");
                if (email == null || email.trim().isEmpty() || !InputValidator.isValidEmail(email.trim())) {
                    sendJsonError(exchange, 400, "Please provide a valid registered email address.");
                    return;
                }
                DatabaseHelper.ForgotPasswordResult res = DatabaseHelper.generatePasswordResetOtp(email);
                if (res.success) {
                    StringBuilder json = new StringBuilder("{");
                    json.append("\"success\": true,");
                    json.append("\"message\": \"").append(escapeJson(res.message)).append("\"");
                    if (res.devOtp != null) {
                        json.append(",\"devOtp\": \"").append(escapeJson(res.devOtp)).append("\"");
                    }
                    json.append("}");
                    sendResponse(exchange, json.toString());
                } else {
                    sendJsonError(exchange, 404, res.message);
                }
            } catch (Exception e) {
                sendJsonError(exchange, 500, "Failed to process request: " + e.getMessage());
            }
        }
    }

    class ResetPasswordHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                sendJsonError(exchange, 405, "Method Not Allowed");
                return;
            }
            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String email = extractJsonField(body, "email");
                String otp = extractJsonField(body, "otp");
                String newPass = extractJsonField(body, "newPassword");

                if (otp != null && !otp.trim().isEmpty()) {
                    if (email == null || email.trim().isEmpty()) {
                        sendJsonError(exchange, 400, "Email address is required.");
                        return;
                    }
                    if (newPass == null || !InputValidator.isValidPassword(newPass)) {
                        sendJsonError(exchange, 400, "Password must be at least 8 characters long and contain uppercase, lowercase, and a number.");
                        return;
                    }
                    DatabaseHelper.ResetPasswordResult res = DatabaseHelper.resetPasswordWithOtp(email, otp, newPass);
                    if (res.success) {
                        sendResponse(exchange, "{\"success\": true, \"message\": \"" + escapeJson(res.message) + "\"}");
                    } else {
                        sendJsonError(exchange, 400, res.message);
                    }
                    return;
                }

                String token = extractToken(exchange);
                if (token.isEmpty()) {
                    sendJsonError(exchange, 401, "Unauthorized or missing credentials.");
                    return;
                }
                if (newPass == null || !InputValidator.isValidPassword(newPass)) {
                    sendJsonError(exchange, 400, "Password must be at least 8 characters long and contain uppercase, lowercase, and a number.");
                    return;
                }
                boolean success = DatabaseHelper.resetPassword(token, newPass);
                if (success) {
                    sendResponse(exchange, "{\"success\": true, \"message\": \"Password updated successfully.\"}");
                } else {
                    sendJsonError(exchange, 400, "Failed to update password.");
                }
            } catch (Exception e) {
                sendJsonError(exchange, 500, "Password reset failed: " + e.getMessage());
            }
        }
    }


    class NotificationsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (token.isEmpty() || DatabaseHelper.getOrgIdFromToken(token) == -1) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }
            String json = DatabaseHelper.getRecentNotifications(token);
            sendResponse(exchange, json);
        }
    }

    public static String[] decodeGoogleJwt(String token) {
        if (token == null || token.trim().isEmpty())
            return null;
        try {
            java.net.URL url = new java.net.URL("https://oauth2.googleapis.com/tokeninfo?id_token=" + token.trim());
            java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            if (conn.getResponseCode() == 200) {
                try (InputStream is = conn.getInputStream()) {
                    String json = new String(is.readAllBytes());

                    String aud = extractJsonField(json, "aud");
                    String expectedAud = System.getenv("GOOGLE_CLIENT_ID") != null ? System.getenv("GOOGLE_CLIENT_ID")
                            : "117803210601-81apks2hhlv1p4og1g5knp85375r69em.apps.googleusercontent.com";
                    if (aud == null || !aud.equals(expectedAud)) {
                        System.err.println("[Google Auth] Invalid aud claim: " + aud);
                        return null;
                    }

                    String email = extractJsonField(json, "email");
                    String name = extractJsonField(json, "name");
                    if (name == null || name.isEmpty())
                        name = email;
                    if (email != null && !email.isEmpty()) {
                        return new String[] { email, name };
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("[Google Auth Verification Error] " + e.getMessage());
        }
        return null;
    }

    class GoogleLoginHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            addCorsHeaders(exchange);
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String token = extractJsonField(body, "token");
                    String[] decoded = decodeGoogleJwt(token);
                    if (decoded != null) {
                        String email = decoded[0];
                        String jsonResponse = DatabaseHelper.loginWithGoogle(email);
                        if (jsonResponse != null) {
                            sendResponse(exchange, jsonResponse);
                            return;
                        }
                    }
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"You haven't joined any workspace yet. Please register your workspace or join as a participant with your Workspace Code first.\"}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Google authentication failed. Please try again.\"}");
                }
            }
        }
    }

    class GoogleOrgSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            addCorsHeaders(exchange);
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String token = extractJsonField(body, "token");
                    String orgName = extractJsonField(body, "orgName");
                    String[] decoded = decodeGoogleJwt(token);
                    if (decoded != null) {
                        String email = decoded[0];
                        String name = decoded[1];
                        String jsonResponse = DatabaseHelper.signupOrgWithGoogle(email, name, orgName);
                        if (jsonResponse != null) {
                            sendResponse(exchange, jsonResponse);
                            return;
                        }
                    }
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"Failed to register organization. Email might be in use.\"}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false}");
                }
            }
        }
    }

    class GoogleEmpSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            addCorsHeaders(exchange);
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String token = extractJsonField(body, "token");
                    String orgCode = extractJsonField(body, "orgCode");
                    String[] decoded = decodeGoogleJwt(token);
                    if (decoded != null) {
                        String email = decoded[0];
                        String name = decoded[1];
                        String jsonResponse = DatabaseHelper.signupEmpWithGoogle(email, name, orgCode);
                        if (jsonResponse != null) {
                            sendResponse(exchange, jsonResponse);
                            return;
                        }
                    }
                    sendResponse(exchange,
                            "{\"success\": false, \"message\": \"Invalid org code or email already in use.\"}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false}");
                }
            }
        }
    }

    class SendInvitesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (!requireManagerOrAdmin(exchange, token))
                return;

            try {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String sessionCode = extractJsonField(body, "sessionCode").trim().toUpperCase();

                // Parse userIds array using a simple string split
                java.util.List<Integer> userIds = new java.util.ArrayList<>();
                if (body.contains("\"userIds\":")) {
                    String arr = body.split("\"userIds\":")[1].split("]")[0].replace("[", "").trim();
                    if (!arr.isEmpty()) {
                        String[] parts = arr.split(",");
                        for (String p : parts) {
                            try {
                                userIds.add(Integer.parseInt(p.trim()));
                            } catch (NumberFormatException ignored) {
                            }
                        }
                    }
                }

                if (sessionCode.isEmpty() || userIds.isEmpty()) {
                    sendJsonError(exchange, 400, "Missing session code or user IDs.");
                    return;
                }

                boolean success = DatabaseHelper.sendInvites(sessionCode, userIds);
                sendResponse(exchange, "{\"success\": " + success + "}");
            } catch (Exception e) {
                sendJsonError(exchange, 500, "Failed to send invites: " + e.getMessage());
            }
        }
    }

    class InvitesHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            addCorsHeaders(exchange);
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if (!"GET".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String token = extractToken(exchange);
            if (token == null || token.isEmpty()) {
                exchange.sendResponseHeaders(401, -1);
                exchange.close();
                return;
            }

            try {
                java.util.List<String> invites = DatabaseHelper.getPendingInvites(token);
                StringBuilder sb = new StringBuilder("[");
                for (int i = 0; i < invites.size(); i++) {
                    sb.append("\"").append(escapeJson(invites.get(i))).append("\"");
                    if (i < invites.size() - 1)
                        sb.append(",");
                }
                sb.append("]");
                sendResponse(exchange, "{\"success\": true, \"invites\": " + sb.toString() + "}");
            } catch (Exception e) {
                sendJsonError(exchange, 500, "Failed to fetch invites.");
            }
        }
    }
}
