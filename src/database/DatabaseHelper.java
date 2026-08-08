package database;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.sql.SQLException;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class DatabaseHelper {

    // --- PostgreSQL Database Configuration ---
    private static final String HOST = System.getenv("DB_HOST") != null ? System.getenv("DB_HOST") : "localhost";
    private static final String PORT = System.getenv("DB_PORT") != null ? System.getenv("DB_PORT") : "5432";
    private static final String DB_NAME = System.getenv("DB_NAME") != null ? System.getenv("DB_NAME") : "MLD_DB";
    private static final String USER = System.getenv("DB_USER") != null ? System.getenv("DB_USER") : "postgres";
    private static final String PASSWORD = System.getenv("DB_PASS") != null ? System.getenv("DB_PASS") : "";
    
    private static String getJdbcUrl() {
        String dbUrl = System.getenv("DATABASE_URL");
        if (dbUrl != null && !dbUrl.isEmpty()) {
            if (dbUrl.startsWith("postgres://")) {
                dbUrl = dbUrl.replace("postgres://", "jdbc:postgresql://");
            } else if (dbUrl.startsWith("postgresql://")) {
                dbUrl = dbUrl.replace("postgresql://", "jdbc:postgresql://");
            }
            if (!dbUrl.startsWith("jdbc:postgresql://")) {
                dbUrl = "jdbc:postgresql://" + dbUrl;
            }
            return dbUrl;
        }
        return "jdbc:postgresql://" + HOST + ":" + PORT + "/" + DB_NAME;
    }
    
    private static boolean postgresAvailable = false;
    private static boolean isDbChecked = false;

    // --- In-Memory Fallback Storage ---
    public static class UserRecord {
        public int userId;
        public String name;
        public String email;
        public String password;
        public String role;
        public int orgId;
        public UserRecord(int userId, String name, String email, String password, String role, int orgId) {
            this.userId = userId; this.name = name; this.email = email; this.password = password; this.role = role; this.orgId = orgId;
        }
    }

    public static class OrgRecord {
        public int orgId;
        public String orgName;
        public String orgCode;
        public OrgRecord(int orgId, String orgName, String orgCode) {
            this.orgId = orgId; this.orgName = orgName; this.orgCode = orgCode;
        }
    }

    private static final Map<String, OrgRecord> orgsByCode = new ConcurrentHashMap<>();
    private static final Map<Integer, OrgRecord> orgsById = new ConcurrentHashMap<>();
    private static final Map<String, UserRecord> usersByEmail = new ConcurrentHashMap<>();
    private static final Map<Integer, UserRecord> usersById = new ConcurrentHashMap<>();
    private static final Map<String, Integer> devicesToUserId = new ConcurrentHashMap<>();
    private static final Map<String, String> activeSessions = new ConcurrentHashMap<>();
    
    private static int nextOrgId = 1;
    private static int nextUserId = 1;

    public static Connection connect() {
        if (isDbChecked && !postgresAvailable) {
            return null;
        }
        try {
            DriverManager.setLoginTimeout(1);
            String rawUrl = System.getenv("DATABASE_URL");
            Connection conn;
            if (rawUrl != null && !rawUrl.isEmpty()) {
                String dbUser = null;
                String dbPass = null;
                String jdbcUrl = rawUrl;

                if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
                    String clean = rawUrl.substring(rawUrl.indexOf("://") + 3);
                    if (clean.contains("@")) {
                        String[] parts = clean.split("@", 2);
                        String userInfo = parts[0];
                        String hostInfo = parts[1];
                        if (userInfo.contains(":")) {
                            String[] userPass = userInfo.split(":", 2);
                            dbUser = userPass[0];
                            dbPass = userPass[1];
                        } else {
                            dbUser = userInfo;
                        }
                        jdbcUrl = "jdbc:postgresql://" + hostInfo;
                    } else {
                        jdbcUrl = "jdbc:postgresql://" + clean;
                    }
                }
                
                if (!jdbcUrl.startsWith("jdbc:postgresql://")) {
                    jdbcUrl = "jdbc:postgresql://" + jdbcUrl;
                }

                if (dbUser != null && dbPass != null) {
                    conn = DriverManager.getConnection(jdbcUrl, dbUser, dbPass);
                } else {
                    conn = DriverManager.getConnection(jdbcUrl);
                }
            } else {
                conn = DriverManager.getConnection("jdbc:postgresql://" + HOST + ":" + PORT + "/" + DB_NAME, USER, PASSWORD);
            }
            postgresAvailable = true;
            isDbChecked = true;
            return conn;
        } catch (SQLException e) {
            if (!isDbChecked) {
                System.err.println("[Database Connection Warning] PostgreSQL connection failed: " + e.getMessage() + ". Using fallback mode.");
            }
            postgresAvailable = false;
            isDbChecked = true;
            return null;
        }
    }

    public static void initializeDatabase() {
        Connection conn = connect();
        if (conn == null) {
            System.out.println("[Database] PostgreSQL server not connected. Running with high-performance In-Memory DB mode.");
            return;
        }

        String createOrganizationsTable = "CREATE TABLE IF NOT EXISTS organizations ("
                + " org_id SERIAL PRIMARY KEY,"
                + " org_name VARCHAR(255) NOT NULL,"
                + " org_code VARCHAR(20) UNIQUE NOT NULL,"
                + " created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                + ");";

        String createUsersTable = "CREATE TABLE IF NOT EXISTS users ("
                + " user_id SERIAL PRIMARY KEY,"
                + " name VARCHAR(255) NOT NULL,"
                + " email VARCHAR(255) UNIQUE NOT NULL,"
                + " password VARCHAR(255) NOT NULL,"
                + " role VARCHAR(50) NOT NULL,"
                + " org_id INTEGER,"
                + " FOREIGN KEY(org_id) REFERENCES organizations(org_id)"
                + ");";

        String createDevicesTable = "CREATE TABLE IF NOT EXISTS devices ("
                + " device_uuid VARCHAR(255) PRIMARY KEY,"
                + " user_id INTEGER,"
                + " FOREIGN KEY(user_id) REFERENCES users(user_id)"
                + ");";

        String createSessionsTable = "CREATE TABLE IF NOT EXISTS sessions ("
                + " session_id SERIAL PRIMARY KEY,"
                + " session_code VARCHAR(20) UNIQUE NOT NULL,"
                + " created_by INTEGER,"
                + " org_id INTEGER,"
                + " created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + " FOREIGN KEY(created_by) REFERENCES users(user_id),"
                + " FOREIGN KEY(org_id) REFERENCES organizations(org_id)"
                + ");";

        String createEngagementLogsTable = "CREATE TABLE IF NOT EXISTS engagement_logs ("
                + " log_id SERIAL PRIMARY KEY,"
                + " session_code VARCHAR(20),"
                + " device_uuid VARCHAR(255),"
                + " score REAL,"
                + " status VARCHAR(50),"
                + " total_checks INTEGER,"
                + " focused_checks INTEGER,"
                + " webcam_active BOOLEAN DEFAULT FALSE,"
                + " timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,"
                + " timeline TEXT,"
                + " is_live BOOLEAN DEFAULT FALSE,"
                + " FOREIGN KEY(device_uuid) REFERENCES devices(device_uuid),"
                + " FOREIGN KEY(session_code) REFERENCES sessions(session_code)"
                + ");";

        try (Statement stmt = conn.createStatement()) {
            stmt.execute(createOrganizationsTable);
            stmt.execute(createUsersTable);
            stmt.execute(createDevicesTable);
            stmt.execute(createSessionsTable);
            stmt.execute(createEngagementLogsTable);
            System.out.println("[Database] PostgreSQL tables initialized and ready for user registration.");
        } catch (SQLException e) {
            System.err.println("PostgreSQL initialization failed: " + e.getMessage());
        } finally {
            try { conn.close(); } catch (Exception ignored) {}
        }

        seedDefaultAccounts();
    }

    private static void seedDefaultAccounts() {
        // Seed In-Memory fallback accounts
        OrgRecord demoOrg = new OrgRecord(1, "Demo Organization", "ORG1000");
        orgsByCode.putIfAbsent("ORG1000", demoOrg);
        orgsById.putIfAbsent(1, demoOrg);

        usersByEmail.putIfAbsent("admin@mld.com", new UserRecord(1, "Manager User", "admin@mld.com", "admin123", "ADMIN", 1));
        usersByEmail.putIfAbsent("employee@mld.com", new UserRecord(2, "Employee User", "employee@mld.com", "emp123", "EMPLOYEE", 1));

        // Seed PostgreSQL if available
        Connection conn = connect();
        if (conn != null) {
            try {
                String checkOrg = "SELECT COUNT(*) FROM organizations";
                try (Statement st = conn.createStatement(); ResultSet rs = st.executeQuery(checkOrg)) {
                    if (rs.next() && rs.getInt(1) == 0) {
                        String insOrg = "INSERT INTO organizations (org_id, org_name, org_code) VALUES (1, 'Demo Organization', 'ORG1000')";
                        st.executeUpdate(insOrg);
                        
                        String insAdmin = "INSERT INTO users (name, email, password, role, org_id) VALUES ('Manager User', 'admin@mld.com', 'admin123', 'ADMIN', 1)";
                        String insEmp = "INSERT INTO users (name, email, password, role, org_id) VALUES ('Employee User', 'employee@mld.com', 'emp123', 'EMPLOYEE', 1)";
                        st.executeUpdate(insAdmin);
                        st.executeUpdate(insEmp);
                        System.out.println("[Database] Default seed accounts initialized in PostgreSQL.");
                    }
                }
            } catch (Exception e) {
                System.err.println("[Database Seed Note] " + e.getMessage());
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
    }

    // --- High Level DAO Methods supporting both PostgreSQL & In-Memory Fallback ---

    public static class LoginResult {
        public boolean success;
        public String token;
        public String role;
        public String name;
        public String message;
        public LoginResult(boolean success, String token, String role, String name, String message) {
            this.success = success; this.token = token; this.role = role; this.name = name; this.message = message;
        }
    }

    public static LoginResult login(String email, String password) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND password = ?";
                PreparedStatement pstmt = conn.prepareStatement(sql);
                pstmt.setString(1, email != null ? email.trim() : "");
                pstmt.setString(2, password != null ? password.trim() : "");
                ResultSet rs = pstmt.executeQuery();
                if (rs.next()) {
                    String role = rs.getString("role");
                    int userId = rs.getInt("user_id");
                    String name = rs.getString("name");
                    String uuid = UUID.randomUUID().toString();

                    try {
                        String ensureCol = "ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id INTEGER";
                        try (Statement st = conn.createStatement()) { st.executeUpdate(ensureCol); } catch (Exception ignored) {}

                        String insertDevice = "INSERT INTO devices(device_uuid, user_id) VALUES (?, ?)";
                        PreparedStatement dStmt = conn.prepareStatement(insertDevice);
                        dStmt.setString(1, uuid);
                        dStmt.setInt(2, userId);
                        dStmt.executeUpdate();
                    } catch (Exception devErr) {
                        System.err.println("[Device Log Warning] " + devErr.getMessage());
                    }

                    conn.close();
                    return new LoginResult(true, uuid, role, name, "Login successful");
                }
                conn.close();
                return new LoginResult(false, null, null, null, "Invalid email or password.");
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback Store Login
        String cleanEmail = email != null ? email.trim() : "";
        String cleanPass = password != null ? password.trim() : "";

        for (UserRecord user : usersByEmail.values()) {
            if (user.email != null && user.email.trim().equalsIgnoreCase(cleanEmail) &&
                user.password != null && user.password.trim().equals(cleanPass)) {
                String uuid = UUID.randomUUID().toString();
                devicesToUserId.put(uuid, user.userId);
                return new LoginResult(true, uuid, user.role, user.name, "Login successful");
            }
        }
        return new LoginResult(false, null, null, null, "Invalid email or password.");
    }

    public static class OrgSignupResult {
        public boolean success;
        public String orgCode;
        public String message;
        public OrgSignupResult(boolean success, String orgCode, String message) {
            this.success = success; this.orgCode = orgCode; this.message = message;
        }
    }

    public static OrgSignupResult signupOrg(String orgName, String managerName, String email, String password) {
        String orgCode = "ORG" + (1000 + new java.util.Random().nextInt(9000));
        Connection conn = connect();
        if (conn != null) {
            try {
                String checkSql = "SELECT u.user_id, o.org_code FROM users u LEFT JOIN organizations o ON u.org_id = o.org_id WHERE u.email = ?";
                try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                    checkStmt.setString(1, email);
                    ResultSet rs = checkStmt.executeQuery();
                    if (rs.next()) {
                        String existingCode = rs.getString("org_code");
                        conn.close();
                        return new OrgSignupResult(false, null, "Email address is already registered. Please login or use a different email.");
                    }
                }

                String insertOrg = "INSERT INTO organizations(org_name, org_code) VALUES (?, ?)";
                try (PreparedStatement pstmt = conn.prepareStatement(insertOrg, java.sql.Statement.RETURN_GENERATED_KEYS)) {
                    pstmt.setString(1, orgName);
                    pstmt.setString(2, orgCode);
                    pstmt.executeUpdate();
                    ResultSet generatedKeys = pstmt.getGeneratedKeys();
                    if (generatedKeys.next()) {
                        int orgId = generatedKeys.getInt(1);
                        String insertSql = "INSERT INTO users(name, email, password, role, org_id) VALUES (?, ?, ?, ?, ?)";
                        try (PreparedStatement pstmtUser = conn.prepareStatement(insertSql)) {
                            pstmtUser.setString(1, managerName);
                            pstmtUser.setString(2, email);
                            pstmtUser.setString(3, password);
                            pstmtUser.setString(4, "ADMIN");
                            pstmtUser.setInt(5, orgId);
                            pstmtUser.executeUpdate();
                        }
                    }
                }
                conn.close();
                return new OrgSignupResult(true, orgCode, "Organization registered successfully.");
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback Org Signup
        if (usersByEmail.containsKey(email)) {
            return new OrgSignupResult(false, null, "Email address is already registered. Please login or use a different email.");
        }

        OrgRecord newOrg = new OrgRecord(nextOrgId++, orgName, orgCode);
        orgsByCode.put(orgCode, newOrg);
        orgsById.put(newOrg.orgId, newOrg);

        UserRecord newAdmin = new UserRecord(nextUserId++, managerName, email, password, "ADMIN", newOrg.orgId);
        usersByEmail.put(email, newAdmin);
        usersById.put(newAdmin.userId, newAdmin);
        
        return new OrgSignupResult(true, orgCode, "Organization registered successfully. Manager account created.");
    }

    public static class EmpSignupResult {
        public boolean success;
        public String message;
        public EmpSignupResult(boolean success, String message) {
            this.success = success; this.message = message;
        }
    }

    public static EmpSignupResult signupEmp(String name, String email, String password, String orgCode) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String selectOrg = "SELECT org_id FROM organizations WHERE org_code = ?";
                try (PreparedStatement pstmtOrg = conn.prepareStatement(selectOrg)) {
                    pstmtOrg.setString(1, orgCode);
                    ResultSet rsOrg = pstmtOrg.executeQuery();
                    if (rsOrg.next()) {
                        int orgId = rsOrg.getInt("org_id");
                        String checkSql = "SELECT user_id FROM users WHERE email = ?";
                        try (PreparedStatement checkStmt = conn.prepareStatement(checkSql)) {
                            checkStmt.setString(1, email);
                            ResultSet rsCheck = checkStmt.executeQuery();
                            if (rsCheck.next()) {
                                conn.close();
                                return new EmpSignupResult(false, "Account already exists with this email! Please log in.");
                            }
                        }
                        String insertSql = "INSERT INTO users(name, email, password, role, org_id) VALUES (?, ?, ?, ?, ?)";
                        try (PreparedStatement pstmtUser = conn.prepareStatement(insertSql)) {
                            pstmtUser.setString(1, name);
                            pstmtUser.setString(2, email);
                            pstmtUser.setString(3, password);
                            pstmtUser.setString(4, "EMPLOYEE");
                            pstmtUser.setInt(5, orgId);
                            pstmtUser.executeUpdate();
                        }
                        conn.close();
                        return new EmpSignupResult(true, "Employee registered successfully.");
                    } else {
                        conn.close();
                        return new EmpSignupResult(false, "Invalid Organization Code.");
                    }
                }
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback Emp Signup
        OrgRecord org = orgsByCode.get(orgCode);
        if (org == null) {
            return new EmpSignupResult(false, "Invalid Organization Code.");
        }

        if (usersByEmail.containsKey(email)) {
            return new EmpSignupResult(false, "Account already exists with this email! Please log in.");
        }

        UserRecord newEmp = new UserRecord(nextUserId++, name, email, password, "EMPLOYEE", org.orgId);
        usersByEmail.put(email, newEmp);
        return new EmpSignupResult(true, "Employee registered successfully.");
    }

    public static class JoinValidationResult {
        public boolean allowed;
        public String message;
        public JoinValidationResult(boolean allowed, String message) {
            this.allowed = allowed;
            this.message = message;
        }
    }

    private static final Map<String, Integer> activeSessionsOrgMap = new ConcurrentHashMap<>();

    public static String createSession(String token) {
        String sessionCode = "MLD" + (100 + new java.util.Random().nextInt(900));
        activeSessions.put(sessionCode.toUpperCase(), sessionCode);

        Connection conn = connect();
        if (conn != null) {
            try {
                int userId = -1; int orgId = -1;
                String getUserSql = "SELECT u.user_id, u.org_id FROM devices d JOIN users u ON d.user_id = u.user_id WHERE d.device_uuid = ?";
                try (PreparedStatement ps = conn.prepareStatement(getUserSql)) {
                    ps.setString(1, token);
                    ResultSet rs = ps.executeQuery();
                    if(rs.next()) {
                        userId = rs.getInt("user_id"); orgId = rs.getInt("org_id");
                    }
                }
                if (orgId != -1) {
                    activeSessionsOrgMap.put(sessionCode.toUpperCase(), orgId);
                }
                String sql = "INSERT INTO sessions(session_code, created_by, org_id) VALUES (?, ?, ?)";
                try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                    pstmt.setString(1, sessionCode);
                    if (userId != -1) pstmt.setInt(2, userId); else pstmt.setNull(2, java.sql.Types.INTEGER);
                    if (orgId != -1) pstmt.setInt(3, orgId); else pstmt.setNull(3, java.sql.Types.INTEGER);
                    pstmt.executeUpdate();
                }
            } catch (Exception ignored) {
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        return sessionCode;
    }

    public static JoinValidationResult validateSessionOrgAccess(String sessionCode, String employeeUuid) {
        if (sessionCode == null || sessionCode.isEmpty()) {
            return new JoinValidationResult(false, "Invalid session code.");
        }
        String upperCode = sessionCode.trim().toUpperCase();

        Connection conn = connect();
        if (conn != null) {
            try {
                // 1. Get session's org_id
                Integer sessionOrgId = null;
                String sessSql = "SELECT org_id FROM sessions WHERE UPPER(session_code) = ?";
                try (PreparedStatement ps = conn.prepareStatement(sessSql)) {
                    ps.setString(1, upperCode);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) {
                        Object obj = rs.getObject("org_id");
                        if (obj != null) sessionOrgId = ((Number) obj).intValue();
                    } else {
                        conn.close();
                        return new JoinValidationResult(false, "Invalid or expired session code.");
                    }
                }

                // 2. Get employee's org_id
                Integer empOrgId = null;
                String empSql = "SELECT u.org_id FROM devices d JOIN users u ON d.user_id = u.user_id WHERE d.device_uuid = ?";
                try (PreparedStatement ps = conn.prepareStatement(empSql)) {
                    ps.setString(1, employeeUuid);
                    ResultSet rs = ps.executeQuery();
                    if (rs.next()) {
                        Object obj = rs.getObject("org_id");
                        if (obj != null) empOrgId = ((Number) obj).intValue();
                    }
                }

                conn.close();

                // 3. Enforce Organization Security Boundary
                if (sessionOrgId != null && empOrgId != null && !sessionOrgId.equals(empOrgId)) {
                    return new JoinValidationResult(false, "Access denied: This session code was generated by another organization.");
                }

                return new JoinValidationResult(true, "Session validated successfully.");

            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback Store Check
        if (activeSessions.containsKey(upperCode)) {
            Integer sessionOrgId = activeSessionsOrgMap.get(upperCode);
            Integer empUserId = devicesToUserId.get(employeeUuid);
            if (sessionOrgId != null && empUserId != null) {
                for (UserRecord u : usersByEmail.values()) {
                    if (u.userId == empUserId) {
                        if (u.orgId != sessionOrgId) {
                            return new JoinValidationResult(false, "Access denied: This session code was generated by another organization.");
                        }
                    }
                }
            }
            return new JoinValidationResult(true, "Session validated successfully.");
        }

        return new JoinValidationResult(false, "Invalid session code.");
    }

    public static boolean isValidSession(String sessionCode) {
        if (sessionCode == null || sessionCode.isEmpty()) return false;
        String upperCode = sessionCode.trim().toUpperCase();

        if (activeSessions.containsKey(upperCode)) return true;

        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT * FROM sessions WHERE UPPER(session_code) = ?";
                try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                    pstmt.setString(1, upperCode);
                    ResultSet rs = pstmt.executeQuery();
                    if (rs.next()) {
                        conn.close();
                        return true;
                    }
                }
            } catch (Exception ignored) {
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        return false;
    }

    public static String getEmployeeNameByUuid(String uuid) {
        if (uuid == null || uuid.isEmpty()) return "Employee";

        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT u.name, u.role FROM devices d JOIN users u ON d.user_id = u.user_id WHERE d.device_uuid = ?";
                try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                    pstmt.setString(1, uuid);
                    ResultSet rs = pstmt.executeQuery();
                    if (rs.next()) {
                        String role = rs.getString("role");
                        if ("ADMIN".equalsIgnoreCase(role) || "MANAGER".equalsIgnoreCase(role)) {
                            String name = rs.getString("name");
                            conn.close();
                            return name + " (" + role + ")";
                        }
                        String name = rs.getString("name");
                        conn.close();
                        return name;
                    }
                }
            } catch (Exception ignored) {
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }

        // Fallback name resolution
        Integer userId = devicesToUserId.get(uuid);
        if (userId != null) {
            for (UserRecord u : usersByEmail.values()) {
                if (u.userId == userId) {
                    if ("ADMIN".equalsIgnoreCase(u.role) || "MANAGER".equalsIgnoreCase(u.role)) return null;
                    return u.name;
                }
            }
        }
        return "Employee (" + (uuid.length() > 6 ? uuid.substring(0, 6) : uuid) + ")";
    }

    public static void saveEngagementLog(String sessionCode, String uuid, double score, String status, int totalChecks, int focusedChecks, boolean webcamActive, String timelineJson) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "INSERT INTO engagement_logs(session_code, device_uuid, score, status, total_checks, focused_checks, webcam_active, timeline, is_live) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true)";
                try (PreparedStatement pstmt = conn.prepareStatement(sql)) {
                    pstmt.setString(1, sessionCode);
                    pstmt.setString(2, uuid);
                    pstmt.setDouble(3, score);
                    pstmt.setString(4, status);
                    pstmt.setInt(5, totalChecks);
                    pstmt.setInt(6, focusedChecks);
                    pstmt.setBoolean(7, webcamActive);
                    pstmt.setString(8, timelineJson != null ? timelineJson : "");
                    pstmt.executeUpdate();
                }
            } catch (Exception ignored) {
            } finally {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
    }
    public static class NotifRecord {
        public int userId;
        public String message;
        public long timestamp;
        public NotifRecord(int userId, String message, long timestamp) {
            this.userId = userId; this.message = message; this.timestamp = timestamp;
        }
    }
    private static List<NotifRecord> notifs = new java.util.concurrent.CopyOnWriteArrayList<>();

    public static String getRecentNotifications(String token) {
        int userId = getUserIdFromToken(token);
        if (userId == -1) return "[]";
        
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT message, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, userId);
                ResultSet rs = ps.executeQuery();
                StringBuilder json = new StringBuilder("[");
                while(rs.next()) {
                    if(json.length() > 1) json.append(",");
                    json.append("{\"message\":\"").append(rs.getString("message")).append("\"}");
                }
                json.append("]");
                conn.close();
                return json.toString();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        
        // Fallback
        StringBuilder json = new StringBuilder("[");
        for (NotifRecord n : notifs) {
            if (n.userId == userId) {
                if(json.length() > 1) json.append(",");
                json.append("{\"message\":\"").append(n.message.replace("\"", "\\\"")).append("\"}");
            }
        }
        json.append("]");
        return json.toString();
    }

    public static String getEmployeesByManagerToken(String token) {
        int orgId = getOrgIdFromToken(token);
        if (orgId == -1) return "[]";
        
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT user_id, name, email FROM users WHERE org_id = ? AND role = 'EMPLOYEE'";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, orgId);
                ResultSet rs = ps.executeQuery();
                StringBuilder json = new StringBuilder("[");
                while (rs.next()) {
                    if (json.length() > 1) json.append(",");
                    json.append("{\"id\":").append(rs.getInt("user_id"))
                        .append(",\"name\":\"").append(rs.getString("name"))
                        .append("\",\"email\":\"").append(rs.getString("email")).append("\"}");
                }
                json.append("]");
                conn.close();
                return json.toString();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        
        // Fallback
        StringBuilder json = new StringBuilder("[");
        for (UserRecord u : usersById.values()) {
            if (u.orgId == orgId && "EMPLOYEE".equals(u.role)) {
                if (json.length() > 1) json.append(",");
                json.append("{\"id\":").append(u.userId)
                    .append(",\"name\":\"").append(u.name)
                    .append("\",\"email\":\"").append(u.email).append("\"}");
            }
        }
        json.append("]");
        return json.toString();
    }

    public static boolean removeEmployee(String token, int empId) {
        String callerRole = getUserRoleFromToken(token);
        if (!"ADMIN".equalsIgnoreCase(callerRole) && !"MANAGER".equalsIgnoreCase(callerRole)) {
            return false;
        }
        int orgId = getOrgIdFromToken(token);
        if (orgId == -1) return false;
        
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "DELETE FROM users WHERE user_id = ? AND org_id = ? AND role = 'EMPLOYEE'";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, empId);
                ps.setInt(2, orgId);
                int rows = ps.executeUpdate();
                conn.close();
                return rows > 0;
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        
        // Fallback
        UserRecord emp = usersById.get(empId);
        if (emp != null && emp.orgId == orgId && "EMPLOYEE".equals(emp.role)) {
            usersById.remove(empId);
            usersByEmail.remove(emp.email);
            return true;
        }
        return false;
    }

    public static String getManagerProfile(String token) {
        int userId = getUserIdFromToken(token);
        if (userId == -1) return "{}";
        
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT u.name, u.email, o.org_name, o.org_code FROM users u JOIN organizations o ON u.org_id = o.org_id WHERE u.user_id = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, userId);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    String json = "{\"name\":\"" + rs.getString("name") + "\",\"email\":\"" + rs.getString("email") 
                        + "\",\"orgName\":\"" + rs.getString("org_name") + "\",\"orgCode\":\"" + rs.getString("org_code") + "\"}";
                    conn.close();
                    return json;
                }
                conn.close();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        
        // Fallback
        UserRecord manager = usersById.get(userId);
        if (manager != null) {
            OrgRecord org = orgsById.get(manager.orgId);
            if (org != null) {
                return "{\"name\":\"" + manager.name + "\",\"email\":\"" + manager.email + "\",\"orgName\":\"" + org.orgName + "\",\"orgCode\":\"" + org.orgCode + "\"}";
            }
        }
        return "{}";
    }

    public static boolean resetPassword(String token, String newPass) {
        int userId = getUserIdFromToken(token);
        if (userId == -1) return false;
        
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "UPDATE users SET password = ? WHERE user_id = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setString(1, newPass);
                ps.setInt(2, userId);
                int rows = ps.executeUpdate();
                conn.close();
                return rows > 0;
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        
        // Fallback
        UserRecord user = usersById.get(userId);
        if (user != null) {
            user.password = newPass;
            return true;
        }
        return false;
    }

    private static int getUserIdFromToken(String token) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT user_id FROM devices WHERE device_uuid = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setString(1, token);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    int uid = rs.getInt("user_id");
                    conn.close();
                    return uid;
                }
                conn.close();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        // Fallback
        Integer uid = devicesToUserId.get(token);
        return uid != null ? uid : -1;
    }

    public static int getOrgIdFromToken(String token) {
        int uid = getUserIdFromToken(token);
        if (uid == -1) return -1;
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT org_id FROM users WHERE user_id = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, uid);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    int orgId = rs.getInt("org_id");
                    conn.close();
                    return orgId;
                }
                conn.close();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        // Fallback
        UserRecord user = usersById.get(uid);
        return user != null ? user.orgId : -1;
    }

    public static String getUserRoleFromToken(String token) {
        int uid = getUserIdFromToken(token);
        if (uid == -1) return null;
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT role FROM users WHERE user_id = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, uid);
                ResultSet rs = ps.executeQuery();
                if (rs.next()) {
                    String role = rs.getString("role");
                    conn.close();
                    return role;
                }
                conn.close();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignore) {}
            }
        }
        UserRecord user = usersById.get(uid);
        return user != null ? user.role : null;
    }

    public static String loginWithGoogle(String email) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String sql = "SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))";
                PreparedStatement pstmt = conn.prepareStatement(sql);
                pstmt.setString(1, email != null ? email.trim() : "");
                ResultSet rs = pstmt.executeQuery();
                if (rs.next()) {
                    String role = rs.getString("role");
                    int userId = rs.getInt("user_id");
                    String name = rs.getString("name");
                    String uuid = UUID.randomUUID().toString();
                    try {
                        String insertDevice = "INSERT INTO devices(device_uuid, user_id) VALUES (?, ?)";
                        PreparedStatement dStmt = conn.prepareStatement(insertDevice);
                        dStmt.setString(1, uuid);
                        dStmt.setInt(2, userId);
                        dStmt.executeUpdate();
                    } catch (Exception devErr) {}
                    conn.close();
                    return "{\"success\": true, \"token\": \"" + uuid + "\", \"role\": \"" + role + "\", \"name\": \"" + name + "\"}";
                }
                conn.close();
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        
        // Fallback Store Login
        UserRecord user = usersByEmail.get(email);
        if (user != null) {
            String uuid = UUID.randomUUID().toString();
            devicesToUserId.put(uuid, user.userId);
            return "{\"success\": true, \"token\": \"" + uuid + "\", \"role\": \"" + user.role + "\", \"name\": \"" + user.name + "\"}";
        }
        return null;
    }

    public static String signupOrgWithGoogle(String email, String name, String orgName) {
        String orgCode = "ORG" + (1000 + new java.util.Random().nextInt(9000));
        Connection conn = connect();
        if (conn != null) {
            try {
                String checkSql = "SELECT u.user_id FROM users u WHERE u.email = ?";
                PreparedStatement checkStmt = conn.prepareStatement(checkSql);
                checkStmt.setString(1, email);
                ResultSet rs = checkStmt.executeQuery();
                if (rs.next()) {
                    conn.close();
                    return null;
                }
                String insertOrg = "INSERT INTO organizations(org_name, org_code) VALUES (?, ?)";
                PreparedStatement pstmt = conn.prepareStatement(insertOrg, java.sql.Statement.RETURN_GENERATED_KEYS);
                pstmt.setString(1, orgName);
                pstmt.setString(2, orgCode);
                pstmt.executeUpdate();
                ResultSet generatedKeys = pstmt.getGeneratedKeys();
                if (generatedKeys.next()) {
                    int orgId = generatedKeys.getInt(1);
                    String insertSql = "INSERT INTO users(name, email, password, role, org_id) VALUES (?, ?, ?, ?, ?)";
                    PreparedStatement pstmtUser = conn.prepareStatement(insertSql);
                    pstmtUser.setString(1, name);
                    pstmtUser.setString(2, email);
                    pstmtUser.setString(3, "GOOGLE_AUTH");
                    pstmtUser.setString(4, "ADMIN");
                    pstmtUser.setInt(5, orgId);
                    pstmtUser.executeUpdate();
                }
                conn.close();
                return "{\"success\": true, \"orgCode\": \"" + orgCode + "\"}";
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        
        // Fallback Org Signup
        if (usersByEmail.containsKey(email)) {
            return null;
        }
        OrgRecord newOrg = new OrgRecord(nextOrgId++, orgName, orgCode);
        orgsByCode.put(orgCode, newOrg);
        orgsById.put(newOrg.orgId, newOrg);
        UserRecord newAdmin = new UserRecord(nextUserId++, name, email, "GOOGLE_AUTH", "ADMIN", newOrg.orgId);
        usersByEmail.put(email, newAdmin);
        usersById.put(newAdmin.userId, newAdmin);
        return "{\"success\": true, \"orgCode\": \"" + orgCode + "\"}";
    }

    public static String signupEmpWithGoogle(String email, String name, String orgCode) {
        Connection conn = connect();
        if (conn != null) {
            try {
                String selectOrg = "SELECT org_id FROM organizations WHERE org_code = ?";
                PreparedStatement pstmtOrg = conn.prepareStatement(selectOrg);
                pstmtOrg.setString(1, orgCode);
                ResultSet rsOrg = pstmtOrg.executeQuery();
                if (!rsOrg.next()) {
                    conn.close();
                    return null;
                }
                int orgId = rsOrg.getInt("org_id");
                
                String checkSql = "SELECT user_id FROM users WHERE email = ?";
                PreparedStatement checkStmt = conn.prepareStatement(checkSql);
                checkStmt.setString(1, email);
                if (checkStmt.executeQuery().next()) {
                    conn.close();
                    return null;
                }
                
                String insertSql = "INSERT INTO users(name, email, password, role, org_id) VALUES (?, ?, ?, ?, ?)";
                PreparedStatement uStmt = conn.prepareStatement(insertSql, java.sql.Statement.RETURN_GENERATED_KEYS);
                uStmt.setString(1, name);
                uStmt.setString(2, email);
                uStmt.setString(3, "GOOGLE_AUTH");
                uStmt.setString(4, "EMPLOYEE");
                uStmt.setInt(5, orgId);
                uStmt.executeUpdate();
                ResultSet uRs = uStmt.getGeneratedKeys();
                if (uRs.next()) {
                    int newUserId = uRs.getInt(1);
                    try {
                        String getManagerSql = "SELECT user_id FROM users WHERE org_id = ? AND role = 'ADMIN'";
                        PreparedStatement getManagerStmt = conn.prepareStatement(getManagerSql);
                        getManagerStmt.setInt(1, orgId);
                        ResultSet manRs = getManagerStmt.executeQuery();
                        while(manRs.next()) {
                            int managerId = manRs.getInt("user_id");
                            String insertNotif = "INSERT INTO notifications (user_id, message) VALUES (?, ?)";
                            PreparedStatement notifStmt = conn.prepareStatement(insertNotif);
                            notifStmt.setInt(1, managerId);
                            notifStmt.setString(2, "New employee " + name + " joined via Google.");
                            notifStmt.executeUpdate();
                        }
                    } catch (Exception ignore) {}
                }
                conn.close();
                return "{\"success\": true}";
            } catch (Exception e) {
                try { conn.close(); } catch (Exception ignored) {}
            }
        }
        
        // Fallback Employee Google Signup
        if (usersByEmail.containsKey(email)) {
            return null; // Already exists
        }
        OrgRecord org = orgsByCode.get(orgCode.toUpperCase());
        if (org == null) return null; // Invalid code

        UserRecord newUser = new UserRecord(nextUserId++, name, email, "GOOGLE_AUTH", "EMPLOYEE", org.orgId);
        usersByEmail.put(email, newUser);
        usersById.put(newUser.userId, newUser);
        
        // Notify manager
        for (UserRecord u : usersById.values()) {
            if (u.orgId == org.orgId && "ADMIN".equals(u.role)) {
                NotifRecord n = new NotifRecord(u.userId, "New employee " + name + " joined via Google.", System.currentTimeMillis());
                notifs.add(n);
            }
        }
        return "{\"success\": true}";
    }
}

