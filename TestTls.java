import java.net.URL;
import java.net.HttpURLConnection;

import java.nio.charset.StandardCharsets;

public class TestTls {
    public static void main(String[] args) throws Exception {
        System.out.println("Testing connection to https://mld-server.onrender.com");
        System.setProperty("javax.net.debug", "ssl,handshake");
        URL url = new URL("https://mld-server.onrender.com/api/heartbeat");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        conn.getOutputStream().write("{}".getBytes(StandardCharsets.UTF_8));
        
        int status = conn.getResponseCode();
        System.out.println("Status: " + status);
    }
}
