package main;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

public class MainCheckDb {
    public static void main(String[] args) {
        String dbUrl = System.getenv("DATABASE_URL");
        if (dbUrl == null || dbUrl.isEmpty()) {
            dbUrl = "jdbc:postgresql://dpg-d9mufflaeets73ar3ddg-a.singapore-postgres.render.com/mld_db?sslmode=require";
        } else if (dbUrl.startsWith("postgres://")) {
            dbUrl = dbUrl.replace("postgres://", "jdbc:postgresql://");
        } else if (dbUrl.startsWith("postgresql://")) {
            dbUrl = dbUrl.replace("postgresql://", "jdbc:postgresql://");
        }

        String user = "mld_db_user";
        String pass = "vh63l8zl1s1zq7H71Qeom2O3TU8anxQL";
        
        try {
            Connection conn = DriverManager.getConnection(dbUrl, user, pass);
            System.out.println("--- CONNECTED TO RENDER CLOUD DATABASE ---");
            
            Statement stmt = conn.createStatement();
            
            System.out.println("\n[TABLE: organizations]");
            ResultSet rsOrg = stmt.executeQuery("SELECT * FROM organizations");
            boolean hasOrgs = false;
            while (rsOrg.next()) {
                hasOrgs = true;
                System.out.println("ID: " + rsOrg.getInt("org_id") + " | Name: " + rsOrg.getString("org_name") + " | Code: " + rsOrg.getString("org_code"));
            }
            if (!hasOrgs) System.out.println(" (No organizations registered yet)");

            System.out.println("\n[TABLE: users]");
            ResultSet rsUsers = stmt.executeQuery("SELECT * FROM users");
            boolean hasUsers = false;
            while (rsUsers.next()) {
                hasUsers = true;
                System.out.println("ID: " + rsUsers.getInt("user_id") + " | Name: " + rsUsers.getString("name") + " | Email: " + rsUsers.getString("email") + " | Role: " + rsUsers.getString("role"));
            }
            if (!hasUsers) System.out.println(" (No users registered yet)");

            System.out.println("\n[TABLE: sessions]");
            ResultSet rsSess = stmt.executeQuery("SELECT * FROM sessions");
            boolean hasSess = false;
            while (rsSess.next()) {
                hasSess = true;
                System.out.println("ID: " + rsSess.getInt("session_id") + " | Code: " + rsSess.getString("session_code") + " | Created: " + rsSess.getTimestamp("created_at"));
            }
            if (!hasSess) System.out.println(" (No sessions created yet)");

            conn.close();
        } catch (Exception e) {
            System.err.println("Database check error: " + e.getMessage());
        }
    }
}
