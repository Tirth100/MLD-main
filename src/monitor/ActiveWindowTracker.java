package monitor;

import com.sun.jna.Native;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.platform.win32.User32;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class ActiveWindowTracker {

    public static String getActiveWindowTitle() {
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) {
                char[] windowText = new char[512];
                WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
                if (hwnd != null) {
                    User32.INSTANCE.GetWindowText(hwnd, windowText, 512);
                    String title = Native.toString(windowText);
                    if (title != null && !title.isEmpty()) return title;
                }
            }
        } catch (Throwable t) {
            // Headless or Non-Windows Environment
        }
        return "Central Server Node";
    }

    public static boolean isWebcamActive() {
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) {
                Process process = Runtime.getRuntime().exec("reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam /s");
                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("LastUsedTimeStop") && line.contains("0x0")) {
                        return true;
                    }
                }
            }
        } catch (Throwable e) {
            // Headless or Non-Windows Environment
        }
        return false;
    }
}