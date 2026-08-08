# MLD Desktop Agent: Technical Deep-Dive

This document provides a highly detailed, step-by-step architectural and code-level breakdown of exactly how the Meeting Leech Detector (MLD) Desktop Agent operates on an employee's machine.

## 1. Launch & Execution Lifecycle
The agent is designed to run seamlessly in the background without interrupting the user's workflow. It ensures Java is present and executes silently.

### A. The Launch Process & Auto-JRE Downloader (`start-mld-agent.ps1`)
To guarantee the agent works on *any* Windows machine without requiring the employee to perform manual Java installations, a custom PowerShell script is used. 

**Code Snippet: Checking for Java & Downloading Portable JRE**
```powershell
$javaExe = "javaw.exe"
try {
    # 1. Check if Java is available globally
    $null = Get-Command javaw.exe -ErrorAction Stop
} catch {
    # 2. Java not found globally. Check for local portable JRE.
    $localJrePath = Get-ChildItem -Path "$ScriptDir\jre\*\bin\javaw.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if (-not $localJrePath) {
        Write-Host "Java is not installed... Downloading a portable Java Runtime (JRE)..."
        $jreUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse?project=jdk"
        Invoke-WebRequest -Uri $jreUrl -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $jreDir -Force
        # ...
    }
}
```
**Silent Execution:** Once `javaw.exe` is located (either globally or the newly downloaded portable version), the script launches the agent invisibly using `-WindowStyle Hidden`:
```powershell
Start-Process -FilePath $javaExe -ArgumentList "-jar MLD-Agent.jar" -WindowStyle Hidden
```

### B. Configuration & One-Time Setup (`MldAgent.java`)
Upon startup, the Java application reads a local configuration file located at `~/.mld_agent.properties`. If the file doesn't exist, it opens a one-time command prompt for authentication.

**Code Snippet: First-Time Login and Credential Storage**
```java
private static final File CONFIG_FILE = new File(System.getProperty("user.home"), ".mld_agent.properties");

// If not configured, prompt for credentials
if (uuid.isEmpty()) {
    System.out.print("Enter Employee Email: ");
    String email = scanner.nextLine().trim();
    System.out.print("Enter Password: ");
    String password = scanner.nextLine().trim();

    LoginResponse loginRes = agentLogin(serverUrl, email, password);
    if (loginRes.success) {
        uuid = loginRes.token;
        saveConfig(serverUrl, uuid, email, employeeName);
        System.out.println("MLD Agent Installed & Activated Successfully!");
    }
}
```

## 2. The Core Monitoring Loop (`MldAgent.java`)
Once authenticated, the agent spins up a `ScheduledExecutorService` that fires a tick exactly **once every 5 seconds**. It enforces a strict "No Session, No Tracking" privacy policy.

**Code Snippet: The 5-Second Background Thread**
```java
ScheduledExecutorService backgroundScheduler = Executors.newSingleThreadScheduledExecutor();

backgroundScheduler.scheduleAtFixedRate(() -> {
    try {
        // 1. Ask backend if manager started a session
        SessionStatus status = getActiveSession(serverUrl, uuid);
        
        if (status.active && status.sessionCode != null) {
            // 2. Collect and transmit telemetry tick only if session is active
            sendTelemetryTick(serverUrl, currentSessionCode, uuid);
        } else {
            // 3. Pause monitoring if session ended
            isMonitoring = false;
        }
    } catch (Throwable t) {
        System.err.println("Telemetry cycle warning: " + t.getMessage());
    }
}, 0, 5, TimeUnit.SECONDS);
```

## 3. Telemetry Collection Mechanics (`ActiveWindowTracker.java`)
While in Monitoring Mode, the agent gathers specific OS-level telemetry. It relies on JNA (Java Native Access) to interface directly with the Windows API without needing heavy C++ binaries.

### A. Active Window Tracking
The agent checks what the user is actively focused on by hooking into `User32.INSTANCE.GetForegroundWindow()`.

**Code Snippet: Getting Foreground Window Title**
```java
public static String getActiveWindowTitle() {
    if (IS_WINDOWS) {
        char[] windowText = new char[512];
        WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
        if (hwnd != null) {
            User32.INSTANCE.GetWindowText(hwnd, windowText, 512);
            String title = Native.toString(windowText);
            
            // Check if user is actively focused on a meeting app
            String lower = title.toLowerCase();
            if (lower.contains("zoom") || lower.contains("meet") || lower.contains("teams")) {
                return title.trim();
            }
        }
        
        // Fallback: If focused elsewhere, check if meeting is running in background
        String meetingWin = scanForMeetingWindows();
        if (meetingWin != null) return meetingWin;
    }
    return "Desktop Workspace";
}
```

**Background Process Scanning (Rate-Limited):**
If the user minimizes Zoom and opens Google Chrome, `GetForegroundWindow()` will report Chrome. To ensure they aren't incorrectly flagged if the meeting is still running in the background, the agent performs a deep process scan using `tasklist /v`. To save CPU, this is rate-limited to once every 3 seconds.
```java
private static synchronized String scanForMeetingWindows() {
    long now = System.currentTimeMillis();
    if (now - lastTasklistScanTime < 3000) return cachedMeetingWindow; // Rate Limiter
    
    Process process = Runtime.getRuntime().exec("cmd /c tasklist /v /fo csv");
    // Parses CSV output for hidden Zoom/Teams processes...
}
```

### B. Webcam Status Detection
Directly accessing camera hardware triggers severe OS security popups. Instead, the agent cleverly queries the Windows `ConsentStore` Registry path.

**Code Snippet: Registry Parsing for Webcam**
```java
public static boolean isWebcamActive() {
    try {
        if (IS_WINDOWS) {
            // Query the ConsentStore for the webcam capability
            Process process = Runtime.getRuntime().exec("reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam /s");
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // If LastUsedTimeStop is 0x0, an application currently holds the camera lock
                    if (line.contains("LastUsedTimeStop") && line.contains("0x0")) {
                        return true;
                    }
                }
            }
        }
    } catch (Throwable e) {}
    return false;
}
```

## 4. Telemetry Transmission
Once the window state and webcam state are collected, the agent formats it into a JSON payload and transmits it to the backend via a POST request.

**Code Snippet: Building and Sending the Payload**
```java
private static void sendTelemetryTick(String baseUrl, String code, String userUuid) {
    String windowTitle = ActiveWindowTracker.getActiveWindowTitle();
    boolean webcamActive = ActiveWindowTracker.isWebcamActive();

    // Construct lightweight JSON payload
    String payload = String.format(
        "{\"uuid\":\"%s\", \"sessionCode\":\"%s\", \"window\":\"%s\", \"webcam\":%b, \"idle\":0}",
        escapeJson(userUuid), escapeJson(code), escapeJson(windowTitle), webcamActive
    );

    String endpoint = baseUrl + "/api/track";
    String responseJson = postHttpRequest(endpoint, payload);

    // If server responds that session is dead, stop immediately.
    if (responseJson.contains("\"active\":false")) {
        isMonitoring = false;
        currentSessionCode = "";
    }
}
```

## 5. Summary of Agent Advantages
1. **Frictionless:** Auto-JRE downloader requires zero technical setup from the employee.
2. **Privacy-Preserving:** The 5-second `ScheduledExecutorService` loop strictly enforces a "No Session, No Tracking" rule. If `getActiveSession()` returns false, it never invokes `ActiveWindowTracker`.
3. **Non-Intrusive & Stealthy:** Uses Windows Registry keys instead of hardware locks to determine webcam status, preventing security warnings and camera light flickering.
4. **Low Resource Footprint:** The combination of a slow 5-second HTTP tick loop and a 3-second rate-limited tasklist scanner ensures the agent consumes practically 0% CPU while running.

## 6. How the Agent Payload Affects Backend Components
When the desktop agent transmits its 5-second telemetry payload, it sets off a chain reaction across the backend components. Here is exactly how the backend ingests and processes this data:

### A. The Ingestion Endpoint (`ApiServer.java` - `TrackHandler`)
The Java web server routes the incoming JSON payload to the `TrackHandler`. It extracts the `uuid`, `sessionCode`, `window`, and `webcam` variables. 
It then updates the `lastAgentHeartbeats` map and immediately passes the data to the employee's dedicated `AttentionAnalyzer` object.

**Code Snippet: ApiServer.java processing the payload**
```java
// Inside TrackHandler.java
if (Main.isMonitoringActive()) {
    // 1. Get or create the user's personal AttentionAnalyzer instance
    service.AttentionAnalyzer analyzer = Main.analyzers.get(uuid);
    if (analyzer == null) {
        analyzer = new service.AttentionAnalyzer();
        Main.analyzers.put(uuid, analyzer);
    }
    
    // 2. Feed the agent's telemetry into the analyzer
    analyzer.analyzeWindow(window, webcam, idle);
    
    // 3. Save the calculated result into PostgreSQL/In-Memory DB
    DatabaseHelper.saveEngagementLog(sessionCode, uuid, analyzer.getAttentionScore(), 
        new service.LeechDetector().checkLeech(analyzer.getAttentionScore()), 
        analyzer.getTotalCount(), analyzer.getFocusedCount(), webcam, "");
        
    sendResponse(exchange, "{\"success\": true, \"active\": true}");
}
```

### B. The Scoring Engine (`AttentionAnalyzer.java`)
The raw `window` string sent by the agent is meaningless until it's processed by the `AttentionAnalyzer`. This component determines if the user is actually focused on a meeting or slacking off.

It converts the window title to lowercase and compares it against an array of authorized meeting keywords. If there is a match (and the user is not AFK/idle), it adds a point to the `focusedCount`.

**Code Snippet: AttentionAnalyzer.java evaluating the agent's window**
```java
public void analyzeWindow(String window, boolean webcam, int idleSeconds) {
    totalCount++;
    boolean isFocused = false;
    
    // Comprehensive case-insensitive matching for valid meeting applications
    String lowerWin = window.toLowerCase();
    if (lowerWin.contains("google meet")
     || lowerWin.contains("zoom")
     || lowerWin.contains("teams")
     || lowerWin.contains("powerpoint")
     || lowerWin.contains("webex")) 
    {
        // Must not be idle to be counted as focused
        if (idleSeconds < 8) {
            isFocused = true;
        }
    }

    if (isFocused) {
        focusedCount++;
        focusHistory.add(100); 
    } else {
        focusHistory.add(0); 
    }
    
    // Add raw string to timeline for manager dashboard
    windowTimeline.add(window); 
}
```

### C. The Web Dashboard UI (`main.js` / Chart.js)
Because `DatabaseHelper` now contains the newly appended `EngagementLog`, the frontend `manager-dashboard.html` automatically pulls these updates via short-polling.
*   **Live Charts:** The `focusHistory` integers (0 or 100) are fed into a live Chart.js instance on the manager's dashboard, creating a real-time line graph of the employee's attention.
*   **Leech Detection:** The `LeechDetector.checkLeech()` function mentioned in the `ApiServer` snippet looks at the final percentage score (`focusedCount / totalCount`). If this score drops below a threshold (e.g., 50%), the backend flags the employee as a "Leech," and a warning notification is instantly pushed to the manager's UI.
