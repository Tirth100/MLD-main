package monitor;

import com.sun.jna.Native;
import com.sun.jna.platform.win32.WinDef;
import com.sun.jna.platform.win32.User32;
import java.util.Arrays;
import java.util.List;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class ActiveWindowTracker {



    public static String getActiveWindowTitle() {
        char[] windowText = new char[512];
        WinDef.HWND hwnd = User32.INSTANCE.GetForegroundWindow();
        User32.INSTANCE.GetWindowText(hwnd, windowText, 512);
        return Native.toString(windowText);
    }

    public static boolean isWebcamActive() {
        try {
            Process process = Runtime.getRuntime().exec("reg query HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\webcam /s");
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.contains("LastUsedTimeStop") && line.contains("0x0")) {
                    return true;
                }
            }
        } catch (Exception e) {
            System.err.println("Webcam check failed: " + e.getMessage());
        }
        return false;
    }
}