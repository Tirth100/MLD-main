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
        if (json == null || field == null || json.isEmpty()) return "";
        try {
            String pattern = "\"" + field + "\"";
            int idx = json.indexOf(pattern);
            if (idx == -1) return "";
            int colonIdx = json.indexOf(":", idx + pattern.length());
            if (colonIdx == -1) return "";
            
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

    public void startServer() throws IOException {
        int port = 3000;
        String portEnv = System.getenv("PORT");
        if (portEnv != null && !portEnv.isEmpty()) {
            try {
                port = Integer.parseInt(portEnv);
            } catch (NumberFormatException ignored) {}
        }

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        
        server.createContext("/", new RootHandler());
        server.createContext("/download/mld-agent", new DownloadAgentHandler());
        server.createContext("/MLDAgent.msi", new DownloadAgentHandler());
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
        server.createContext("/api/signup-org", new OrgSignupHandler());
        server.createContext("/api/signup-emp", new EmpSignupHandler());
        server.createContext("/api/track", new TrackHandler());
        server.createContext("/api/active-session", new ActiveSessionHandler());
        server.createContext("/api/employees", new EmployeesHandler());
        server.createContext("/api/employees/remove", new RemoveEmployeeHandler());
        server.createContext("/api/profile", new ProfileHandler());
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
            boolean isSafePath = path.startsWith("/css/") || path.startsWith("/js/") || path.startsWith("/assets/") || path.endsWith(".html") || path.equals("/favicon.ico");
            
            if (isSafePath && file.exists() && !file.isDirectory() && file.getPath().startsWith(baseDir.getPath() + java.io.File.separator)) {
                byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());
                String contentType = "text/html";
                if (path.endsWith(".css")) contentType = "text/css";
                else if (path.endsWith(".js")) contentType = "application/javascript";
                else if (path.endsWith(".svg")) contentType = "image/svg+xml";
                else if (path.endsWith(".png")) contentType = "image/png";
                else if (path.endsWith(".json")) contentType = "application/json";
                else if (path.endsWith(".ico")) contentType = "image/x-icon";
                
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

            sendResponse(exchange, "{\"status\": \"online\", \"service\": \"Meeting Leech Detector Central Server\", \"version\": \"1.0.0\"}");
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
                java.io.File fileToServe = new java.io.File("MLDAgent.zip");
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("installer/MLDAgent.zip");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("mld-agent-app/installer/MLD Agent-1.0.0.msi");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("MLD-Agent.zip");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("MLD-Agent.jar");
                }
                if (fileToServe.exists()) {
                    byte[] bytes = java.nio.file.Files.readAllBytes(fileToServe.toPath());
                    exchange.getResponseHeaders().set("Content-Type", "application/zip");
                    exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"MLDAgent.zip\"");
                    exchange.sendResponseHeaders(200, bytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(bytes);
                    }
                } else {
                    String msg = "MLD Agent zip installer file not found on server.";
                    exchange.sendResponseHeaders(404, msg.length());
                    try (OutputStream os = exchange.getResponseBody()) { os.write(msg.getBytes()); }
                }
            } catch (Exception e) {
                sendResponse(exchange, "{\"error\": \"Download failed\"}");
            }
        }
    }

    private static final Map<String, Long> lastAgentHeartbeats = new ConcurrentHashMap<>();
    private static final Map<String, String> activeJoinedSessions = new ConcurrentHashMap<>();

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
                isConnected, isConnected ? "Connected" : "Offline", uuid);
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
                try (java.util.Scanner s = new java.util.Scanner(is, java.nio.charset.StandardCharsets.UTF_8).useDelimiter("\\A")) {
                    body = s.hasNext() ? s.next() : "{}";
                }
                // Extract uuid from JSON body: {"uuid":"..."}
                String uuid = "";
                int idx = body.indexOf("\"uuid\":");
                if (idx >= 0) {
                    int q1 = body.indexOf('"', idx + 7);
                    int q2 = body.indexOf('"', q1 + 1);
                    if (q1 >= 0 && q2 > q1) uuid = body.substring(q1 + 1, q2);
                }
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
            if (token == null || token.isEmpty()) {
                token = userUuid;
            }
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId != -1 && Main.isMonitoringActive(orgId)) {
                if (!userUuid.isEmpty() && activeJoinedSessions.containsKey(userUuid)) {
                    active = true;
                    code = activeJoinedSessions.get(userUuid);
                } else if (userUuid.isEmpty()) {
                    active = true;
                    code = Main.orgSessions.get(orgId).sessionCode;
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
            if (orgId == -1) return;
            if (!requireManagerOrAdmin(exchange, token)) return;
            try {
                if (!Main.isMonitoringActive(orgId)) {
                    sendResponse(exchange, "{\"success\": true, \"message\": \"No active session to stop.\"}");
                    return;
                }
                String sessionCode = Main.orgSessions.get(orgId).sessionCode;
                DatabaseHelper.invalidateSession(sessionCode);
                Main.stopMonitoring(orgId);
                activeJoinedSessions.entrySet().removeIf(entry -> DatabaseHelper.getOrgIdFromToken(entry.getKey()) == orgId);
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped.\"}");
            } catch (Exception e) {
                System.err.println("Stop error: " + e.getMessage());
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped with warning: " + e.getMessage() + "\"}");
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
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Unauthorized session leave request.\"}");
                    return;
                }
                
                if (!uuid.isEmpty()) {
                    activeJoinedSessions.remove(uuid);
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
                if (orgId == -1) return;
                if (!requireManagerOrAdmin(exchange, token)) return;
                
                String sessionCode;
                synchronized (Main.orgSessions) {
                    if (Main.isMonitoringActive(orgId)) {
                        sessionCode = Main.orgSessions.get(orgId).sessionCode;
                        sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode + "\", \"message\": \"Session already active with code " + sessionCode + "\"}");
                        return;
                    }
                    sessionCode = DatabaseHelper.createSession(token);
                    Main.startMonitoring(orgId, sessionCode);
                }
                sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode + "\", \"message\": \"Session started successfully with code " + sessionCode + "\"}");
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

                DatabaseHelper.JoinValidationResult validation = DatabaseHelper.validateSessionOrgAccess(sessionCode, uuid);
                if (!validation.allowed) {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"" + validation.message + "\"}");
                    return;
                }

                if (DatabaseHelper.isValidSession(sessionCode)) {
                    activeJoinedSessions.put(uuid.toLowerCase(), sessionCode);
                    Main.analyzers.put(uuid.toLowerCase(), new service.AttentionAnalyzer());
                    sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode + "\", \"message\": \"Joined session successfully.\"}");
                } else {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Session is not currently active.\"}");
                }
            } catch (Exception e) {
                e.printStackTrace();
                sendResponse(exchange, "{\"success\": false, \"message\": \"Failed to join session.\"}");
            }
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
                        sendResponse(exchange, "{\"success\": false, \"active\": false, \"message\": \"Unauthorized track request.\"}");
                        return;
                    }
                    
                    String sessionCode = extractJsonField(body, "sessionCode").trim();
                    String window = extractJsonField(body, "window");
                    int idle = 0;
                    if (body.contains("\"idle\"")) {
                        try {
                            String idleStr = body.split("\"idle\"")[1].split(":")[1].split("[,}]")[0].trim();
                            idle = Integer.parseInt(idleStr);
                        } catch (Exception ex) {}
                    }
                    boolean webcam = body.contains("\"webcam\":true") || body.contains("\"webcam\": true");
                    
                    if (!uuid.isEmpty()) {
                        lastAgentHeartbeats.put(uuid.toLowerCase(), System.currentTimeMillis());
                    }

                    int orgId = DatabaseHelper.getOrgIdFromToken(uuid);
                    if (orgId != -1 && Main.isMonitoringActive(orgId)) {
                        String cleanUuid = uuid.toLowerCase();
                        service.AttentionAnalyzer analyzer = Main.analyzers.get(cleanUuid);
                        if (analyzer == null) {
                            analyzer = new service.AttentionAnalyzer();
                            Main.analyzers.put(cleanUuid.isEmpty() ? uuid : cleanUuid, analyzer);
                        }
                        analyzer.analyzeWindow(window, webcam, idle);
                        
                        String activeSessionCode = sessionCode;
                        if (activeSessionCode == null || activeSessionCode.isEmpty()) {
                            activeSessionCode = Main.orgSessions.get(orgId).sessionCode;
                        }
                        
                        DatabaseHelper.saveEngagementLog(activeSessionCode, uuid, analyzer.getAttentionScore(), new service.LeechDetector().checkLeech(analyzer.getAttentionScore()), analyzer.getTotalCount(), analyzer.getFocusedCount(), webcam, "");
                        sendResponse(exchange, "{\"success\": true, \"active\": true}");
                    } else {
                        sendResponse(exchange, "{\"success\": true, \"active\": false, \"message\": \"Session stopped by manager.\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Track error: " + e.getMessage());
                    sendResponse(exchange, "{\"success\": false, \"active\": false, \"message\": \"" + e.getMessage() + "\"}");
                }
            }
        }
    }

    private void addCorsHeaders(HttpExchange exchange) {
        String origin = exchange.getRequestHeaders().getFirst("Origin");
        String allowedOrigin = "http://localhost:3000"; // default safe fallback
        
        if (origin != null && (
            origin.equals("http://localhost:3000") || 
            origin.equals("http://localhost:8000") ||
            origin.equals("https://mld-server.onrender.com") ||
            origin.equals("https://mld-main.onrender.com"))) {
            allowedOrigin = origin;
        }

        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", allowedOrigin);
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization, Bypass-Tunnel-Reminder, Cache-Control");
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
            if (orgId == -1) return;

            if ("DELETE".equals(exchange.getRequestMethod())) {
                if (!requireManagerOrAdmin(exchange, token)) return;
                String query = exchange.getRequestURI().getQuery();
                if (query != null && query.startsWith("timestamp=")) {
                    String timestamp = java.net.URLDecoder.decode(query.substring(10), "UTF-8");
                    boolean deleted = ReportGenerator.deleteReportForOrganization(timestamp, orgId);
                    if (deleted) {
                        sendResponse(exchange, "{\"success\": true, \"message\": \"Report deleted.\"}");
                    } else {
                        sendJsonError(exchange, 404, "Report not found or access denied.");
                    }
                } else {
                    sendJsonError(exchange, 400, "Missing timestamp.");
                }
                return;
            }

            // Retrieve actual JSON Array generated strictly from local file storage removing all placeholders
            StringBuilder combinedJson = new StringBuilder("[");
            String localReports = ReportGenerator.getAllReportsAsJsonArray(orgId);
            if (localReports.length() > 2) {
                combinedJson.append(localReports.substring(1, localReports.length() - 1));
            }
            
            // Inject the currently active live session into the array natively
            if (Main.isMonitoringActive(orgId)) {
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId) continue;
                    
                    service.AttentionAnalyzer analyzer = entry.getValue();
                    
                    String empName = getEmployeeNameByUuid(uuid);
                    if (empName == null) continue; // Skip managers/admins from employee engagement table

                    double score = analyzer.getTotalCount() > 0 ? analyzer.getAttentionScore() : 1.0;
                    int scorePct = (int) Math.round(score * 100);
                    String stat = new service.LeechDetector().checkLeech(score);
                    String lastWin = analyzer.getWindowTimeline().isEmpty() ? "Meeting Workspace" : analyzer.getWindowTimeline().get(analyzer.getWindowTimeline().size() - 1);

                    String liveJson = String.format(
                        "{\"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"activeWindow\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"webcamActive\": %b, \"idleSeconds\": %d, \"durationSeconds\": %d, \"sessionCode\": \"%s\", \"timestamp\": \"Live Session\", \"isLive\": true}",
                        empName, scorePct, stat, lastWin, analyzer.getTotalCount(), analyzer.getFocusedCount(), analyzer.isWebcamActive(), analyzer.getIdleSeconds(), analyzer.getDurationSeconds(), Main.orgSessions.get(orgId).sessionCode
                    );
                    
                    if (combinedJson.length() > 1) combinedJson.append(", ");
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
            String token = extractToken(exchange);
            int orgId = DatabaseHelper.getOrgIdFromToken(token);
            if (orgId == -1) {
                exchange.sendResponseHeaders(401, -1);
                return;
            }

            // Strict < 0.5 threshold logic
            StringBuilder combinedJson = new StringBuilder("[");
            boolean hasLocal = false;
            
            if (Main.isMonitoringActive(orgId)) {
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId) continue;
                    
                    service.AttentionAnalyzer analyzer = entry.getValue();
                    if (analyzer.getTotalCount() > 0) {
                        double score = analyzer.getAttentionScore();
                        if (score < 0.5) {
                            if (hasLocal) combinedJson.append(",");
                            String empName = getEmployeeNameByUuid(uuid);
                            combinedJson.append("\n{ \"name\": \"").append(empName).append("\", \"reason\": \"Tracking detected low window focus under 50% (< 0.5)\", \"time\": \"Current Session\" }\n");
                            hasLocal = true;
                        }
                    }
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
                    if (DatabaseHelper.getOrgIdFromToken(uuid) != orgId) continue;
                    
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
            for(int i=0; i<history.size(); i++) {
                timeLabels += "\"" + (i*10) + "s\"" + (i < history.size()-1 ? "," : "");
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
            int score = count > 0 ? (int)Math.round((sumScore / count) * 100) : 0;
            int focus = count > 0 ? score : 0;
            String status = (orgId != -1 && Main.isMonitoringActive(orgId)) ? "Active Monitoring Session (" + Main.orgSessions.get(orgId).sessionCode + ")" : "Session Stopped";
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
                    sendResponse(exchange, "{\"success\": true, \"token\": \"" + res.token + "\", \"role\": \"" + res.role + "\", \"name\": \"" + res.name + "\"}");
                } else {
                    int attempts = loginAttempts.getOrDefault(ip, 0) + 1;
                    loginAttempts.put(ip, attempts);
                    if (attempts >= 5) {
                        loginLockouts.put(ip, System.currentTimeMillis());
                        sendResponse(exchange, "{\"success\": false, \"message\": \"Too many login attempts. Please wait 1 minute.\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                }
            } catch (Exception e) {
                System.err.println("Login error: " + e.getMessage());
                sendResponse(exchange, "{\"success\": false, \"message\": \"Login failed: " + e.getMessage() + "\"}");
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
                    String managerName = extractJsonField(body, "managerName");
                    String email = extractJsonField(body, "email").trim();
                    String password = extractJsonField(body, "password").trim();
                    
                    if (!InputValidator.isValidEmail(email) || !InputValidator.isValidPassword(password) || !InputValidator.isValidName(orgName)) {
                        sendJsonError(exchange, 400, "Invalid input formats. Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number.");
                        return;
                    }
                    
                    DatabaseHelper.OrgSignupResult res = DatabaseHelper.signupOrg(orgName, managerName, email, password);
                    if (res.success) {
                        sendResponse(exchange, "{\"success\": true, \"orgCode\": \"" + res.orgCode + "\", \"message\": \"" + res.message + "\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Org Signup error: " + e.getMessage());
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Signup failed: " + e.getMessage() + "\"}");
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
                    
                    if (!InputValidator.isValidEmail(email) || !InputValidator.isValidPassword(password) || !InputValidator.isValidName(name)) {
                        sendJsonError(exchange, 400, "Invalid input formats. Password must be 8+ chars, 1 uppercase, 1 lowercase, 1 number.");
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
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Signup failed: " + e.getMessage() + "\"}");
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
            
            // Generate basic CSV dynamically (Hack method: splitting JSON without Jackson for speed since it's raw format)
            String csv = "Name,Role,Score,Status,TotalChecks,FocusedChecks,Timestamp,ActivitySummary\n";
            String[] reports = jsonArray.split("\"name\": \"");
            for(int i = 1; i < reports.length; i++) {
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
                            if (endIdx != -1) extracted = extracted.substring(0, endIdx);
                        }
                        timeline = extracted.replace("\r", "").replace("\n", "").replace(",", ";").replace("\"", "'").replace("  ", " ");
                    }
                    csv += name + ",Employee," + scoreStr + "," + statusStr + "," + totCheck + "," + focCheck + "," + timestamp + "," + timeline + "\n";
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
            if (REVOKED_TOKENS.contains(token)) return "";
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
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
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
                if (idStr.isEmpty()) idStr = "0";
                boolean success = DatabaseHelper.removeEmployee(token, Integer.parseInt(idStr));
                sendResponse(exchange, "{\"success\": " + success + "}");
            } catch (Exception e) {
                sendResponse(exchange, "{\"success\": false, \"message\": \"" + e.getMessage() + "\"}");
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

    class ResetPasswordHandler implements HttpHandler {
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
                String token = extractToken(exchange);
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String newPass = extractJsonField(body, "newPassword");
                    boolean success = DatabaseHelper.resetPassword(token, newPass);
                    sendResponse(exchange, "{\"success\": " + success + "}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false}");
                }
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
        if (token == null || token.trim().isEmpty()) return null;
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
                    String expectedAud = System.getenv("GOOGLE_CLIENT_ID") != null ? System.getenv("GOOGLE_CLIENT_ID") : "875383442505-YOUR_CLIENT_ID.apps.googleusercontent.com";
                    if (aud == null || !aud.equals(expectedAud)) {
                        System.err.println("[Google Auth] Invalid aud claim: " + aud);
                        return null;
                    }
                    
                    String email = extractJsonField(json, "email");
                    String name = extractJsonField(json, "name");
                    if (name == null || name.isEmpty()) name = email;
                    if (email != null && !email.isEmpty()) {
                        return new String[]{email, name};
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
                    sendResponse(exchange, "{\"success\": false, \"message\": \"User not found. Please register first.\"}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false}");
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
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Failed to register organization. Email might be in use.\"}");
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
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Invalid org code or email already in use.\"}");
                } catch (Exception e) {
                    sendResponse(exchange, "{\"success\": false}");
                }
            }
        }
    }
    }

