package test;

import database.PasswordUtil;
import database.DatabaseHelper;
import service.AttentionAnalyzer;
import service.LeechDetector;
import api.InputValidator;

public class MldUnitTestSuite {

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

    private static void assertEquals(String testName, Object expected, Object actual) {
        totalTests++;
        if (expected == null && actual == null) {
            passedTests++;
            System.out.println("  [PASS] " + testName);
        } else if (expected != null && expected.equals(actual)) {
            passedTests++;
            System.out.println("  [PASS] " + testName);
        } else {
            failedTests++;
            System.err.println("  [FAIL] " + testName + " | Expected: " + expected + ", Actual: " + actual);
        }
    }

    public static void testPasswordUtil() {
        System.out.println("\n=== 1. PasswordUtil (PBKDF2 Cryptography) Tests ===");
        
        String rawPassword = "SecurePassword@123";
        String hash = PasswordUtil.hashPassword(rawPassword);
        
        assertTrue("Hash is non-null and not empty", hash != null && !hash.isEmpty());
        
        String[] parts = hash.split(":");
        assertEquals("Hash format has 3 parts (iterations:salt:hash)", 3, parts.length);
        assertEquals("Iteration count is 65536", "65536", parts[0]);
        assertEquals("Salt length is 24 Base64 chars (16 bytes)", 24, parts[1].length());
        
        assertTrue("verifyPassword returns true for correct password", PasswordUtil.verifyPassword(rawPassword, hash));
        assertTrue("verifyPassword returns false for wrong password", !PasswordUtil.verifyPassword("WrongPassword123", hash));
        assertTrue("verifyPassword returns false for empty password", !PasswordUtil.verifyPassword("", hash));
    }

    public static void testAttentionAnalyzer() {
        System.out.println("\n=== 2. AttentionAnalyzer (Sliding Window & Focus Engine) Tests ===");
        
        AttentionAnalyzer analyzer = new AttentionAnalyzer();
        
        assertEquals("Initial total count is 0", 0, analyzer.getTotalCount());
        assertEquals("Initial focused count is 0", 0, analyzer.getFocusedCount());
        assertEquals("Initial score is 0.0", 0.0, analyzer.getAttentionScore());

        analyzer.analyzeWindow("Zoom Meeting", true, 0);
        assertEquals("Startup 10-second buffer filters out premature sample", 0, analyzer.getTotalCount());

        try {
            java.lang.reflect.Field field = AttentionAnalyzer.class.getDeclaredField("startTime");
            field.setAccessible(true);
            field.setLong(analyzer, System.currentTimeMillis() - 15000); // 15 seconds ago
        } catch (Exception e) {
            System.err.println("Reflection error: " + e.getMessage());
        }

        // Test 1: Approved Meeting Window: Zoom
        analyzer.analyzeWindow("Zoom Meeting - Sprint Planning", true, 0);
        assertEquals("Zoom meeting increments totalCount", 1, analyzer.getTotalCount());
        assertEquals("Zoom meeting increments focusedCount", 1, analyzer.getFocusedCount());

        // Test 2: Approved Meeting Window: Google Meet
        analyzer.analyzeWindow("Google Meet: Standup Call", true, 0);
        assertEquals("Google Meet increments totalCount", 2, analyzer.getTotalCount());
        assertEquals("Google Meet increments focusedCount", 2, analyzer.getFocusedCount());

        // Test 3: Approved Meeting Window: Microsoft Teams
        analyzer.analyzeWindow("Microsoft Teams | Engineering Channel", false, 0);
        assertEquals("Microsoft Teams increments totalCount", 3, analyzer.getTotalCount());
        assertEquals("Microsoft Teams increments focusedCount", 3, analyzer.getFocusedCount());

        // Test 4: Approved Meeting Window: PowerPoint Slide Show
        analyzer.analyzeWindow("PowerPoint Slide Show - Architecture.pptx", true, 0);
        assertEquals("PowerPoint increments totalCount", 4, analyzer.getTotalCount());
        assertEquals("PowerPoint increments focusedCount", 4, analyzer.getFocusedCount());

        // Test 5: Self-referential title exclusion ("Meeting Leech Detector")
        analyzer.analyzeWindow("Meeting Leech Detector - Employee Portal", true, 0);
        assertEquals("MLD window increments totalCount", 5, analyzer.getTotalCount());
        assertEquals("MLD window does NOT increment focusedCount", 4, analyzer.getFocusedCount());

        // Test 6: Distracted window (Browser / Social Media)
        analyzer.analyzeWindow("YouTube - Cat Videos - Google Chrome", true, 0);
        assertEquals("YouTube window increments totalCount", 6, analyzer.getTotalCount());
        assertEquals("YouTube window does NOT increment focusedCount", 4, analyzer.getFocusedCount());

        // Test 7: Hardware idle duration penalty (idle >= 8 seconds)
        analyzer.analyzeWindow("Zoom Meeting - Sprint Planning", true, 12);
        assertEquals("Idle window increments totalCount", 7, analyzer.getTotalCount());
        assertEquals("Idle window increments idleTicks", 10, analyzer.getIdleSeconds());

        // Test 8: Score calculation (4 focused out of 7 total)
        double expectedScore = (double) 5 / 7; // Wait: Zoom(1), Meet(1), Teams(1), PowerPoint(1), Zoom+Idle(1 focused window but idle increments idleTicks)
        // Let's verify: In AttentionAnalyzer: focusedCount is incremented if isFocused is true!
        // The last sample had "Zoom Meeting" -> isFocused=true, so focusedCount=5!
        assertEquals("Total focused count is 5", 5, analyzer.getFocusedCount());
        assertTrue("Attention score matches focused/total ratio (within 0.01)", 
                   Math.abs(analyzer.getAttentionScore() - expectedScore) < 0.01);

        // Test 9: Buffer bounded limit (max 1000 items)
        for (int i = 0; i < 1100; i++) {
            analyzer.analyzeWindow("Zoom Meeting", true, 0);
        }
        assertTrue("Window timeline is strictly bounded to max 1000 items", analyzer.getWindowTimeline().size() <= 1000);
        assertTrue("Focus timeline is strictly bounded to max 1000 items", analyzer.getFocusTimeline().size() <= 1000);
        assertTrue("Focus history is strictly bounded to max 1000 items", analyzer.getFocusHistory().size() <= 1000);

        // Test 10: Reset
        analyzer.reset();
        assertEquals("Reset zeroes total count", 0, analyzer.getTotalCount());
        assertEquals("Reset zeroes focused count", 0, analyzer.getFocusedCount());
        assertEquals("Reset clears window timeline", 0, analyzer.getWindowTimeline().size());
    }

    public static void testLeechDetector() {
        System.out.println("\n=== 3. LeechDetector (Classification Rules) Tests ===");
        
        LeechDetector detector = new LeechDetector();
        
        assertEquals("Score 0.95 is Engaged", "Engaged", detector.checkLeech(0.95));
        assertEquals("Score 0.75 boundary is Engaged", "Engaged", detector.checkLeech(0.75));
        assertEquals("Score 0.74 is Focused", "Focused", detector.checkLeech(0.74));
        assertEquals("Score 0.50 boundary is Focused", "Focused", detector.checkLeech(0.50));
        assertEquals("Score 0.49 is Low Engagement (Leech)", "Low Engagement", detector.checkLeech(0.49));
        assertEquals("Score 0.15 is Low Engagement (Leech)", "Low Engagement", detector.checkLeech(0.15));
        assertEquals("Score 0.00 is Low Engagement (Leech)", "Low Engagement", detector.checkLeech(0.00));
    }

    public static void testInputValidator() {
        System.out.println("\n=== 4. InputValidator (Input Sanitization) Tests ===");
        
        assertTrue("Valid standard email passes", InputValidator.isValidEmail("john.doe@company.org"));
        assertTrue("Invalid email without @ fails", !InputValidator.isValidEmail("johndoecompany.org"));
        assertTrue("Invalid email without domain fails", !InputValidator.isValidEmail("john@"));
        assertTrue("Null email fails", !InputValidator.isValidEmail(null));
        
        assertTrue("Valid 8+ char password with Upper, Lower & Digit passes", InputValidator.isValidPassword("P@ssw0rd123"));
        assertTrue("Short password (<8 chars) fails", !InputValidator.isValidPassword("Pass1"));
        assertTrue("Password without digits fails", !InputValidator.isValidPassword("PasswordOnly"));
        assertTrue("Null password fails", !InputValidator.isValidPassword(null));
        
        assertTrue("Valid display name passes", InputValidator.isValidName("Rudra Dev"));
        assertTrue("Name with hyphens and apostrophes passes", InputValidator.isValidName("Sarah O'Connor-Smith"));
        assertTrue("Name with quotes fails (injection defense)", !InputValidator.isValidName("John \"DropTable\" Doe"));
        assertTrue("Name with angle brackets fails (XSS defense)", !InputValidator.isValidName("<script>alert(1)</script>"));

        assertEquals("sanitizeString strips HTML/XML tags", "Clean Text", InputValidator.sanitizeString("<b>Clean Text</b>"));
        assertEquals("sanitizeString handles null safely", "", InputValidator.sanitizeString(null));
    }

    public static void testJsonEscaping() {
        System.out.println("\n=== 5. DatabaseHelper.escapeJson() Security Tests ===");
        
        assertEquals("Standard text unaltered", "Hello World", DatabaseHelper.escapeJson("Hello World"));
        assertEquals("Double quote escaped to \\\"", "Hello \\\"World\\\"", DatabaseHelper.escapeJson("Hello \"World\""));
        assertEquals("Backslash escaped to \\\\", "C:\\\\path\\\\file", DatabaseHelper.escapeJson("C:\\path\\file"));
        assertEquals("Newline escaped to \\n", "Line1\\nLine2", DatabaseHelper.escapeJson("Line1\nLine2"));
        assertEquals("Tab escaped to \\t", "Col1\\tCol2", DatabaseHelper.escapeJson("Col1\tCol2"));
        assertEquals("Null input returns empty string", "", DatabaseHelper.escapeJson(null));
    }

    public static void main(String[] args) {
        System.out.println("================================================================");
        System.out.println("      MEETING LEECH DETECTOR (MLD) - LIVE UNIT TEST BENCH       ");
        System.out.println("================================================================");
        
        testPasswordUtil();
        testAttentionAnalyzer();
        testLeechDetector();
        testInputValidator();
        testJsonEscaping();
        
        System.out.println("\n----------------------------------------------------------------");
        System.out.println("UNIT TESTING SUMMARY: Total: " + totalTests + " | Passed: " + passedTests + " | Failed: " + failedTests);
        System.out.println("----------------------------------------------------------------");
        
        if (failedTests > 0) {
            throw new RuntimeException("Unit testing failed with " + failedTests + " errors.");
        }
    }
}
