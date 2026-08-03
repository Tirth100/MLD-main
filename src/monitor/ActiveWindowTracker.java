package monitor;

import com.sun.jna.Native;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.platform.win32.User32;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class ActiveWindowTracker {

    private static final boolean IS_WINDOWS = System.getProperty("os.name", "").toLowerCase().contains("win");
    private static long lastTasklistScanTime = 0;
    private static String cachedMeetingWindow = null;

    public static String getActiveWindowTitle() {
        try {
            if (IS_WINDOWS) {
                char[] windowText = new char[512];
                WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
                if (hwnd != null) {
                    User32.INSTANCE.GetWindowText(hwnd, windowText, 512);
                    String title = Native.toString(windowText);
                    if (title != null && !title.trim().isEmpty()) {
                        String lower = title.toLowerCase();
                        if (lower.contains("zoom") || lower.contains("meet") || lower.contains("teams") || lower.contains("powerpoint") || lower.contains("webex")) {
                            return title.trim();
                        }
                    }
                }

                // If foreground window is generic or non-meeting, check if any meeting application is running (rate-limited scan)
                String meetingWin = scanForMeetingWindows();
                if (meetingWin != null && !meetingWin.isEmpty()) {
                    return meetingWin;
                }

                if (hwnd != null) {
                    User32.INSTANCE.GetWindowText(hwnd, windowText, 512);
                    String fgTitle = Native.toString(windowText);
                    if (fgTitle != null && !fgTitle.trim().isEmpty()) {
                        return fgTitle.trim();
                    }
                }
            }
        } catch (Throwable t) {
            // Headless or Non-Windows Environment
        }
        return "Desktop Workspace";
    }

    private static synchronized String scanForMeetingWindows() {
        long now = System.currentTimeMillis();
        // Rate-limit process scanning to once every 3 seconds to preserve CPU resources
        if (now - lastTasklistScanTime < 3000) {
            return cachedMeetingWindow;
        }
        lastTasklistScanTime = now;
        cachedMeetingWindow = null;

        try {
            Process process = Runtime.getRuntime().exec("cmd /c tasklist /v /fo csv");
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    String lower = line.toLowerCase();
                    if (lower.contains("zoom") || lower.contains("meet") || lower.contains("teams") || lower.contains("powerpnt") || lower.contains("webex")) {
                        String[] parts = line.split("\",\"");
                        if (parts.length >= 9) {
                            String winTitle = parts[8].replace("\"", "").trim();
                            if (!winTitle.isEmpty() && !winTitle.equalsIgnoreCase("N/A")) {
                                cachedMeetingWindow = winTitle;
                                return winTitle;
                            }
                        }
                    }
                }
            }
        } catch (Throwable ignored) {}
        return cachedMeetingWindow;
    }

    public static boolean isWebcamActive() {
        try {
            if (IS_WINDOWS) {
                Process process = Runtime.getRuntime().exec("reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam /s");
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.contains("LastUsedTimeStop") && line.contains("0x0")) {
                            return true;
                        }
                    }
                }
            }
        } catch (Throwable e) {
            // Headless or Non-Windows Environment
        }
        return false;
    }
}