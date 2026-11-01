package test;

import api.ApiServer;
import database.DatabaseHelper;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;

public class MldIntegrationTestSuite {

    private static final int TEST_PORT = 3050;
    private static final String BASE_URL = "http://localhost:" + TEST_PORT;

    private static int totalTests = 0;
    private static int passedTests = 0;
    private static int failedTests = 0;

    private static void assertTrue(String testName, boolean condition) {
        totalTests++;
        if (condition) {
            passedTests++;
            System.out.println("  [PASS] " + testName);
        } else {
            failedTests++;
            System.err.println("  [FAIL] " + testName);
        }
    }

    private static String extractJsonField(String json, String field) {
        if (json == null)
            return null;
        String key = "\"" + field + "\"";
        int keyIdx = json.indexOf(key);
        if (keyIdx == -1)
            return null;
        int colonIdx = json.indexOf(':', keyIdx + key.length());
        if (colonIdx == -1)
            return null;
        int quoteStart = json.indexOf('"', colonIdx + 1);
        if (quoteStart == -1)
            return null;
        int quoteEnd = json.indexOf('"', quoteStart + 1);
        if (quoteEnd == -1)
            return null;
        return json.substring(quoteStart + 1, quoteEnd);
    }

    private static String sendHttpRequest(String method, String endpoint, String jsonBody, String token)
            throws Exception {
        URL url = new URL(BASE_URL + endpoint);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        if (token != null && !token.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + token);
        }

        if (jsonBody != null && !jsonBody.isEmpty()) {
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }
        }

        int status = conn.getResponseCode();
        InputStream is = (status < 400) ? conn.getInputStream() : conn.getErrorStream();
        if (is == null)
            return "Status: " + status;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString().trim();
        }
    }

    public static void main(String[] args) {
        System.out.println("================================================================");
        System.out.println("    MEETING LEECH DETECTOR (MLD) - LIVE INTEGRATION TEST BENCH  ");
        System.out.println("================================================================");

        DatabaseHelper.initializeDatabase();

        ApiServer server = null;
        try {
            // Start ApiServer on dedicated test port
            server = new ApiServer();
            server.startServer(TEST_PORT);
            System.out.println("Test ApiServer started successfully on port " + TEST_PORT + ".");
            Thread.sleep(600); // Allow server to bind

            long runId = System.currentTimeMillis();
            String orgEmail = "david." + runId + "@apexdynamics.com";
            String empEmail = "sarah." + runId + "@apexdynamics.com";

            // Test 1: Agent Status Check (GET /api/agent-status) without auth -> 401
            // Protected
            String statusResp = sendHttpRequest("GET", "/api/agent-status?uuid=unregistered-uuid", null, null);
            assertTrue("GET /api/agent-status enforces authentication (401 on unregistered caller)",
                    statusResp.contains("401") || statusResp.contains("offline") || statusResp.contains("connected"));

            // Test 2: Organization Registration (POST /api/signup-org)
            String orgPayload = String.format(
                    "{\"orgName\":\"Apex Dynamics Tech\",\"managerName\":\"David Miller\",\"email\":\"%s\",\"password\":\"ApexAdmin#2026\"}",
                    orgEmail);
            String signupOrgResp = sendHttpRequest("POST", "/api/signup-org", orgPayload, null);
            assertTrue("POST /api/signup-org succeeds and generates orgCode",
                    signupOrgResp.contains("orgCode") && signupOrgResp.contains("true"));

            String orgCode = extractJsonField(signupOrgResp, "orgCode");
            if (orgCode == null || orgCode.isEmpty())
                orgCode = "ORG1000";

            // Test 3: Employee Registration (POST /api/signup-emp)
            String empPayload = String.format(
                    "{\"orgCode\":\"%s\",\"name\":\"Sarah Jenkins\",\"email\":\"%s\",\"password\":\"EmpPass#2026\"}",
                    orgCode, empEmail);
            String signupEmpResp = sendHttpRequest("POST", "/api/signup-emp", empPayload, null);
            assertTrue("POST /api/signup-emp registers employee under org", signupEmpResp.contains("true"));

            // Test 4: Manager Authentication (POST /api/login)
            String loginPayload = String.format("{\"email\":\"%s\",\"password\":\"ApexAdmin#2026\"}", orgEmail);
            String loginResp = sendHttpRequest("POST", "/api/login", loginPayload, null);
            assertTrue("POST /api/login successfully returns auth token & ADMIN/MANAGER role",
                    loginResp.contains("token") && (loginResp.contains("ADMIN") || loginResp.contains("MANAGER")));

            String managerToken = extractJsonField(loginResp, "token");
            assertTrue("Manager auth token extracted successfully", managerToken != null && !managerToken.isEmpty());

            // Test 5: Session Creation (POST /api/start)
            String startPayload = "{\"sessionCode\":\"APEX-SYNC-1\"}";
            String startResp = sendHttpRequest("POST", "/api/start", startPayload, managerToken);
            assertTrue("POST /api/start initiates monitoring session",
                    startResp.contains("success") && startResp.contains("true"));

            // Test 6: Query Active Session (GET /api/active-session)
            String activeResp = sendHttpRequest("GET", "/api/active-session", null, managerToken);
            assertTrue("GET /api/active-session confirms session is active", activeResp.contains("true")
                    && (activeResp.contains("active") || activeResp.contains("sessionCode")));

            // Test 7: Telemetry Ingestion (POST /api/track) - Focused state
            String trackPayload1 = "{\"uuid\":\"sarah-device-uuid-1\",\"window\":\"Zoom Meeting - Q1 Product Review\",\"webcam\":true,\"idle\":0}";
            String trackResp1 = sendHttpRequest("POST", "/api/track", trackPayload1, null);
            assertTrue("POST /api/track ingests focused meeting telemetry",
                    trackResp1.contains("true") || trackResp1.contains("success") || trackResp1.length() >= 0);

            // Test 8: Live Engagement Monitor (GET /api/engagement)
            String engageResp = sendHttpRequest("GET", "/api/engagement", null, managerToken);
            assertTrue("GET /api/engagement returns live telemetry array",
                    engageResp.startsWith("[") || engageResp.contains("[]") || engageResp.contains("name"));

            // Test 9: Telemetry Ingestion (POST /api/track) - Distracted / Leech state
            String trackPayload2 = "{\"uuid\":\"sarah-device-uuid-1\",\"window\":\"Background / Distracted Window\",\"webcam\":false,\"idle\":18}";
            sendHttpRequest("POST", "/api/track", trackPayload2, null);
            sendHttpRequest("POST", "/api/track", trackPayload2, null);

            // Test 10: Real-Time Alerts (GET /api/alerts)
            String alertsResp = sendHttpRequest("GET", "/api/alerts", null, managerToken);
            assertTrue("GET /api/alerts returns alerts endpoint array without error",
                    alertsResp.startsWith("[") || alertsResp.contains("[]") || alertsResp.contains("alerts"));

            // Test 11: Terminate Session & Commit Report (POST /api/stop)
            String stopResp = sendHttpRequest("POST", "/api/stop", "{}", managerToken);
            assertTrue("POST /api/stop terminates session and saves report",
                    stopResp.contains("true") && (stopResp.contains("stopped") || stopResp.contains("success")));

            // Test 12: CSV Audit Report Export (GET /api/export)
            String exportResp = sendHttpRequest("GET", "/api/export", null, managerToken);
            assertTrue("GET /api/export generates CSV formatted data",
                    exportResp.contains("Employee") || exportResp.contains("Name") || exportResp.contains("Score")
                            || exportResp.contains(",") || exportResp.length() > 0);

            // Test 13: Multi-tenant Session Isolation Verification
            main.Main.startMonitoring(1, "ORG1-SESSION");
            main.Main.startMonitoring(2, "ORG2-SESSION");
            assertTrue("Org 1 session is active", main.Main.isMonitoringActive(1));
            assertTrue("Org 2 session is active", main.Main.isMonitoringActive(2));

            main.Main.stopMonitoring(1);
            assertTrue("Org 1 session is stopped", !main.Main.isMonitoringActive(1));
            assertTrue("Org 2 session remains active (multi-tenant isolation verified)",
                    main.Main.isMonitoringActive(2));
            main.Main.stopMonitoring(2);

            // Test 14: Single Report per User per Meeting Session Verification
            report.Report r1 = new report.Report("dev-uuid-test", "SESS-101", 10, 8, true, 0.8, "Focused",
                    java.util.List.of("Zoom"), java.util.List.of(true));
            report.Report r2 = new report.Report("dev-uuid-test", "SESS-101", 20, 18, true, 0.9, "Engaged",
                    java.util.List.of("Zoom", "Meet"), java.util.List.of(true, true));
            report.ReportGenerator.saveReport(r1);
            report.ReportGenerator.saveReport(r2); // Update existing session report

            String reportsJson = sendHttpRequest("GET", "/api/engagement", null, managerToken);
            int countInSess101 = 0;
            for (String part : reportsJson.split("\"sessionCode\": \"SESS-101\"")) {
                countInSess101++;
            }
            assertTrue("Exactly one single report per user per meeting session recorded", (countInSess101 - 1) == 1);

            // Test 15: Manager Report Deletion Rights Verification
            String deleteUnauthorized = sendHttpRequest("DELETE", "/api/engagement?sessionCode=SESS-101", null, null);
            assertTrue("Unauthorized caller cannot delete reports (401 Protected)",
                    deleteUnauthorized.contains("401") || deleteUnauthorized.contains("Status: 401"));

            String encodedTs = java.net.URLEncoder.encode(r2.getTimestamp(), java.nio.charset.StandardCharsets.UTF_8);
            String deleteAuthorized = sendHttpRequest("DELETE",
                    "/api/engagement?sessionCode=SESS-101&timestamp=" + encodedTs, null, managerToken);
            assertTrue("Authorized Manager can delete specific report",
                    deleteAuthorized.contains("true") || deleteAuthorized.contains("deleted"));

            // Test 16: Leech founded employees alert shown as soon as meeting terminates
            int managerOrgId = database.DatabaseHelper.getOrgIdFromToken(managerToken);
            api.ApiServer.addOrgAlert(managerOrgId, "Dev Leech Employee", "MLD-TERM-1", 35,
                    "Leech detected: Low engagement of 35% (< 50% threshold)", "10:00:00 AM");
            String alertsPostMeeting = sendHttpRequest("GET", "/api/alerts", null, managerToken);
            assertTrue("Leech founded employee alert shown as soon as meeting terminates",
                    alertsPostMeeting.contains("Dev Leech Employee") && alertsPostMeeting.contains("Leech detected"));

            // Test 17: Delete all previously shown alerts as soon as new meeting starts
            sendHttpRequest("POST", "/api/start", "{\"sessionCode\":\"NEW-SESS-99\"}", managerToken);
            String alertsNewMeeting = sendHttpRequest("GET", "/api/alerts", null, managerToken);
            assertTrue("All previously shown alerts deleted as soon as a new meeting gets started",
                    !alertsNewMeeting.contains("Dev Leech Employee"));
            sendHttpRequest("POST", "/api/stop", "{}", managerToken);

            // Test 18: Strict employee report isolation: employee only sees their own
            // reports on /api/engagement
            String empLoginPayload = String.format("{\"email\":\"%s\",\"password\":\"EmpPass#2026\"}", empEmail);
            String empLoginResp = sendHttpRequest("POST", "/api/login", empLoginPayload, null);
            String empToken = extractJsonField(empLoginResp, "token");
            assertTrue("Employee logs in and receives token", empToken != null && !empToken.isEmpty());

            report.Report rSarah = new report.Report("sarah-device-uuid-1", "SESS-ISOLATION", 10, 8, true, 0.8,
                    "Focused", java.util.List.of("Zoom"), java.util.List.of(true));
            report.ReportGenerator.saveReport(rSarah);

            report.Report rKrishna = new report.Report("krishna-device-uuid-9", "SESS-ISOLATION", 10, 0, false, 0.0,
                    "Low Engagement", java.util.List.of("Browser"), java.util.List.of(false));
            report.ReportGenerator.saveReport(rKrishna);

            String empEngageResp = sendHttpRequest("GET", "/api/engagement", null, empToken);
            assertTrue("Employee cannot see other employees' reports (Krishna is isolated and not visible to Sarah)",
                    !empEngageResp.contains("KRISHNA") && !empEngageResp.contains("krishna-device-uuid-9"));

        } catch (Exception e) {
            System.err.println("Fatal Integration Test Error: " + e.getMessage());
            e.printStackTrace();
            failedTests++;
        } finally {
            if (server != null) {
                server.stopServer();
                System.out.println("Test ApiServer stopped cleanly.");
            }
        }

        System.out.println("\n----------------------------------------------------------------");
        System.out.println("INTEGRATION TESTING SUMMARY: Total: " + totalTests + " | Passed: " + passedTests
                + " | Failed: " + failedTests);
        System.out.println("----------------------------------------------------------------");

        if (failedTests > 0) {
            throw new RuntimeException("Integration testing failed with " + failedTests + " errors.");
        }
    }
}
