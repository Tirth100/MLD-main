package test;

public class MldMasterTestRunner {

    public static void main(String[] args) {
        System.out.println("################################################################");
        System.out.println("   MEETING LEECH DETECTOR (MLD) - MASTER VERIFICATION RUNNER   ");
        System.out.println("################################################################\n");

        long start = System.currentTimeMillis();

        try {
            // 1. Unit Testing
            MldUnitTestSuite.main(new String[0]);
            System.out.println();

            // 2. Integration Testing
            MldIntegrationTestSuite.main(new String[0]);
            System.out.println();

            // 3. Security Testing
            MldSecurityTestSuite.main(new String[0]);
            System.out.println();

            // 4. Performance & Validation Testing
            MldPerformanceValidationBenchmark.main(new String[0]);
            System.out.println();

            long elapsed = System.currentTimeMillis() - start;
            System.out.println("################################################################");
            System.out.println("       ALL PROJECT TEST SUITES EXECUTED AND PASSED (100%)       ");
            System.out.println("       Total End-to-End Test Execution Time: " + elapsed + " ms   ");
            System.out.println("################################################################");

            System.exit(0);

        } catch (Throwable t) {
            System.err.println("CRITICAL TEST RUNNER EXCEPTION: " + t.getMessage());
            t.printStackTrace();
            System.exit(1);
        }
    }
}
