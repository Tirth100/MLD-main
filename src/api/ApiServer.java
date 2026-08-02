package api;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.net.InetAddress;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import main.Main;
import report.ReportGenerator;
import database.DatabaseHelper;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;

public class ApiServer {
    


    public void startServer() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(3000), 0);
        
        server.createContext("/", new RootHandler());
        server.createContext("/download/mld-agent", new DownloadAgentHandler());
        server.createContext("/api/agent-status", new AgentStatusHandler());
        server.createContext("/api/engagement", new EngagementHandler());
        server.createContext("/api/alerts", new AlertsHandler());
        server.createContext("/api/analytics", new AnalyticsHandler());
        server.createContext("/api/employee-stats", new EmployeeStatsHandler());
        server.createContext("/api/export", new ExportHandler());
        server.createContext("/api/stop", new StopHandler());
        server.createContext("/api/start", new StartHandler());
        server.createContext("/api/join", new JoinHandler());
        server.createContext("/api/login", new LoginHandler());
        server.createContext("/api/signup-org", new OrgSignupHandler());
        server.createContext("/api/signup-emp", new EmpSignupHandler());
        server.createContext("/api/track", new TrackHandler());
        server.createContext("/api/active-session", new ActiveSessionHandler());

        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        System.out.println("API Server started on port 3000!");
    }

    class RootHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
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
                java.io.File fileToServe = new java.io.File("MLD-Agent.exe");
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("run-agent.bat");
                }
                if (!fileToServe.exists()) {
                    fileToServe = new java.io.File("MLD-Agent.jar");
                }
                if (fileToServe.exists()) {
                    byte[] bytes = java.nio.file.Files.readAllBytes(fileToServe.toPath());
                    exchange.getResponseHeaders().set("Content-Type", "application/octet-stream");
                    exchange.getResponseHeaders().set("Content-Disposition", "attachment; filename=\"" + fileToServe.getName() + "\"");
                    exchange.sendResponseHeaders(200, bytes.length);
                    try (OutputStream os = exchange.getResponseBody()) {
                        os.write(bytes);
                    }
                } else {
                    String msg = "MLD Agent installer file not found on server.";
                    exchange.sendResponseHeaders(404, msg.length());
                    try (OutputStream os = exchange.getResponseBody()) { os.write(msg.getBytes()); }
                }
            } catch (Exception e) {
                sendResponse(exchange, "{\"error\": \"Download failed\"}");
            }
        }
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
            String query = exchange.getRequestURI().getQuery();
            String uuid = "";
            if (query != null && query.contains("uuid=")) {
                uuid = query.split("uuid=")[1].split("&")[0].trim();
            }

            boolean isConnected = false;
            if (!uuid.isEmpty() && Main.analyzers.containsKey(uuid)) {
                service.AttentionAnalyzer analyzer = Main.analyzers.get(uuid);
                if (analyzer != null && analyzer.getTotalCount() > 0) {
                    isConnected = true;
                }
            }

            String json = String.format("{\"connected\": %b, \"status\": \"%s\", \"uuid\": \"%s\"}", 
                isConnected, isConnected ? "Connected" : "Offline", uuid);
            sendResponse(exchange, json);
        }
    }

    class ActiveSessionHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            boolean active = Main.isMonitoringActive();
            String code = active ? Main.currentSessionCode : "";
            sendResponse(exchange, "{\"active\": " + active + ", \"sessionCode\": \"" + code + "\"}");
        }
    }



    class StopHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            try {
                Main.stopMonitoring();
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped.\"}");
            } catch (Exception e) {
                System.err.println("Stop error: " + e.getMessage());
                sendResponse(exchange, "{\"success\": true, \"message\": \"Session stopped with warning: " + e.getMessage() + "\"}");
            }
        }
    }

    private static String extractJsonField(String json, String field) {
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

    class StartHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            try {
                java.io.InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                String token = extractJsonField(body, "token");
                
                String sessionCode = DatabaseHelper.createSession(token);
                Main.startMonitoring(sessionCode);
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

                DatabaseHelper.JoinValidationResult validation = DatabaseHelper.validateSessionOrgAccess(sessionCode, uuid);
                if (!validation.allowed) {
                    sendResponse(exchange, "{\"success\": false, \"message\": \"" + validation.message + "\"}");
                    return;
                }

                if (Main.isMonitoringActive() && sessionCode.equalsIgnoreCase(Main.currentSessionCode)) {
                    Main.analyzers.put(uuid, new service.AttentionAnalyzer());
                    sendResponse(exchange, "{\"success\": true, \"sessionCode\": \"" + sessionCode + "\", \"message\": \"Joined session successfully.\"}");
                } else if (DatabaseHelper.isValidSession(sessionCode)) {
                    Main.analyzers.put(uuid, new service.AttentionAnalyzer());
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
                    
                    String uuid = extractJsonField(body, "uuid");
                    String window = extractJsonField(body, "window");
                    int idle = 0;
                    if (body.contains("\"idle\"")) {
                        try {
                            String idleStr = body.split("\"idle\"")[1].split(":")[1].split("[,}]")[0].trim();
                            idle = Integer.parseInt(idleStr);
                        } catch (Exception ex) {}
                    }
                    boolean webcam = body.contains("\"webcam\":true") || body.contains("\"webcam\": true");
                    
                    if (Main.isMonitoringActive() && Main.analyzers.containsKey(uuid)) {
                        Main.analyzers.get(uuid).analyzeWindow(window, webcam, idle);
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
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "*");
        exchange.getResponseHeaders().set("Access-Control-Max-Age", "86400");
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
            if ("DELETE".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                String query = exchange.getRequestURI().getQuery();
                if (query != null && query.startsWith("timestamp=")) {
                    String timestamp = java.net.URLDecoder.decode(query.substring(10), "UTF-8");
                    ReportGenerator.deleteReport(timestamp);
                    exchange.sendResponseHeaders(200, -1);
                } else {
                    exchange.sendResponseHeaders(400, -1);
                }
                return;
            }

            // Retrieve actual JSON Array generated strictly from local file storage removing all placeholders
            StringBuilder combinedJson = new StringBuilder("[");
            String localReports = ReportGenerator.getAllReportsAsJsonArray();
            if (localReports.length() > 2) {
                combinedJson.append(localReports.substring(1, localReports.length() - 1));
            }
            
            // Inject the currently active live session into the array natively
            if (Main.isMonitoringActive()) {
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
                    service.AttentionAnalyzer analyzer = entry.getValue();
                    
                    double score = analyzer.getTotalCount() > 0 ? analyzer.getAttentionScore() : 1.0;
                    int scorePct = (int) Math.round(score * 100);
                    String stat = new service.LeechDetector().checkLeech(score);
                    String empName = getEmployeeNameByUuid(uuid);
                    
                    String liveJson = String.format(
                        "{\"name\": \"%s\", \"role\": \"Employee\", \"score\": %d, \"status\": \"%s\", \"totalChecks\": %d, \"focusedChecks\": %d, \"webcamActive\": %b, \"idleSeconds\": %d, \"durationSeconds\": %d, \"sessionCode\": \"%s\", \"timestamp\": \"Live Session\", \"isLive\": true}",
                        empName, scorePct, stat, analyzer.getTotalCount(), analyzer.getFocusedCount(), analyzer.isWebcamActive(), analyzer.getIdleSeconds(), analyzer.getDurationSeconds(), Main.currentSessionCode
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
            // Strict < 0.5 threshold logic
            StringBuilder combinedJson = new StringBuilder("[");
            boolean hasLocal = false;
            
            if (Main.isMonitoringActive()) {
                for (java.util.Map.Entry<String, service.AttentionAnalyzer> entry : Main.analyzers.entrySet()) {
                    String uuid = entry.getKey();
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
            int focused = 0;
            int total = 0;
            java.util.List<Integer> history = new java.util.ArrayList<>();
            
            if (Main.isMonitoringActive()) {
                for (service.AttentionAnalyzer analyzer : Main.analyzers.values()) {
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
            double sumScore = 0;
            int count = 0;
            if (Main.isMonitoringActive()) {
                for (service.AttentionAnalyzer analyzer : Main.analyzers.values()) {
                    if (analyzer.getTotalCount() > 0) {
                        sumScore += analyzer.getAttentionScore();
                        count++;
                    }
                }
            }
            int score = count > 0 ? (int)Math.round((sumScore / count) * 100) : 0;
            int focus = count > 0 ? score : 0;
            String status = Main.isMonitoringActive() ? "Active Monitoring Session (" + Main.currentSessionCode + ")" : "Session Stopped";
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
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if ("POST".equals(exchange.getRequestMethod())) {
                InputStream is = exchange.getRequestBody();
                String body = new String(is.readAllBytes());
                try {
                    String email = extractJsonField(body, "email").trim();
                    String password = extractJsonField(body, "password").trim();
                    
                    DatabaseHelper.LoginResult res = DatabaseHelper.login(email, password);
                    if (res.success) {
                        sendResponse(exchange, "{\"success\": true, \"token\": \"" + res.token + "\", \"role\": \"" + res.role + "\", \"name\": \"" + res.name + "\"}");
                    } else {
                        sendResponse(exchange, "{\"success\": false, \"message\": \"" + res.message + "\"}");
                    }
                } catch (Exception e) {
                    System.err.println("Login error: " + e.getMessage());
                    sendResponse(exchange, "{\"success\": false, \"message\": \"Login failed: " + e.getMessage() + "\"}");
                }
            }
        }
    }

    class OrgSignupHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
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
                    String email = extractJsonField(body, "email");
                    String password = extractJsonField(body, "password");
                    
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
            if ("OPTIONS".equals(exchange.getRequestMethod())) {
                addCorsHeaders(exchange);
                exchange.sendResponseHeaders(204, -1);
                exchange.close();
                return;
            }
            if ("POST".equals(exchange.getRequestMethod())) {
                try {
                    InputStream is = exchange.getRequestBody();
                    String body = new String(is.readAllBytes());
                    String name = extractJsonField(body, "name");
                    String email = extractJsonField(body, "email");
                    String password = extractJsonField(body, "password");
                    String orgCode = extractJsonField(body, "orgCode");
                    
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
            exchange.getResponseHeaders().add("Content-Type", "text/csv");
            exchange.getResponseHeaders().add("Content-Disposition", "attachment; filename=\"report.csv\"");
            
            // Fetch aggregated reports via local API call to include remote employees
            String jsonArray = "[]";
            try {
                URL url = new URL("http://localhost:3000/api/engagement");
                HttpURLConnection con = (HttpURLConnection) url.openConnection();
                con.setRequestMethod("GET");
                if (con.getResponseCode() == 200) {
                    jsonArray = new String(con.getInputStream().readAllBytes());
                }
            } catch (Exception e) {
                jsonArray = ReportGenerator.getAllReportsAsJsonArray();
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
}
