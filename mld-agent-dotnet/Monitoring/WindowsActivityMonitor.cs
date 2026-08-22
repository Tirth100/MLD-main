using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

namespace MldAgent.Monitoring
{
    public static class WindowsActivityMonitor
    {
        public static readonly string[] MeetingAppKeywords = new string[]
        {
            "zoom", "meet", "teams", "powerpoint", "webex", "powerpnt", "slack", "discord", "huddle", "chime", "bluejeans", "skype"
        };

        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO
        {
            public uint cbSize;
            public uint dwTime;
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [DllImport("kernel32.dll")]
        private static extern uint GetTickCount();

        private static long _lastScanTicks = 0;
        private static string _cachedMeetingWindow = null;
        private static readonly object ScanLock = new object();

        public static string GetActiveWindowTitle()
        {
            try
            {
                IntPtr hwnd = GetForegroundWindow();
                if (hwnd != IntPtr.Zero)
                {
                    int length = GetWindowTextLength(hwnd);
                    if (length > 0)
                    {
                        var sb = new StringBuilder(length + 1);
                        GetWindowText(hwnd, sb, sb.Capacity);
                        string title = sb.ToString().Trim();

                        if (!string.IsNullOrEmpty(title))
                        {
                            return title;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Error getting active window title", ex);
            }

            return "Desktop Workspace";
        }

        private static string ScanForMeetingWindows()
        {
            long now = DateTime.UtcNow.Ticks;
            lock (ScanLock)
            {
                if ((now - _lastScanTicks) < TimeSpan.FromSeconds(3).Ticks)
                {
                    return _cachedMeetingWindow;
                }
                _lastScanTicks = now;
                _cachedMeetingWindow = null;

                try
                {
                    Process[] processes = Process.GetProcesses();
                    foreach (Process p in processes)
                    {
                        try
                        {
                            string title = p.MainWindowTitle;
                            if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(title.Trim())) continue;

                            string lower = title.ToLowerInvariant();
                            foreach (string kw in MeetingAppKeywords)
                            {
                                if (lower.Contains(kw))
                                {
                                    _cachedMeetingWindow = title.Trim();
                                    return _cachedMeetingWindow;
                                }
                            }
                        }
                        catch
                        {
                            // Ignore access denied for system processes
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logging.AgentLogger.LogError("Error during process scan", ex);
                }

                return _cachedMeetingWindow;
            }
        }

        public static bool IsWebcamActive()
        {
            try
            {
                const string keyPath = @"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam";
                using (RegistryKey baseKey = Registry.CurrentUser.OpenSubKey(keyPath))
                {
                    if (baseKey == null) return false;

                    foreach (string subKeyName in baseKey.GetSubKeyNames())
                    {
                        if (subKeyName.Equals("NonPackaged", StringComparison.OrdinalIgnoreCase))
                        {
                            using (RegistryKey nonPackaged = baseKey.OpenSubKey(subKeyName))
                            {
                                if (nonPackaged == null) continue;
                                foreach (string appKeyName in nonPackaged.GetSubKeyNames())
                                {
                                    using (RegistryKey appKey = nonPackaged.OpenSubKey(appKeyName))
                                    {
                                        if (appKey == null) continue;
                                        object stopTimeObj = appKey.GetValue("LastUsedTimeStop");
                                        if (stopTimeObj is long && (long)stopTimeObj == 0)
                                        {
                                            return true;
                                        }
                                    }
                                }
                            }
                        }
                        else
                        {
                            using (RegistryKey appKey = baseKey.OpenSubKey(subKeyName))
                            {
                                if (appKey == null) continue;
                                object stopTimeObj = appKey.GetValue("LastUsedTimeStop");
                                if (stopTimeObj is long && (long)stopTimeObj == 0)
                                {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Error reading webcam registry", ex);
            }

            return false;
        }

        public static int GetIdleSeconds()
        {
            try
            {
                var lii = new LASTINPUTINFO();
                lii.cbSize = (uint)Marshal.SizeOf(lii);
                if (GetLastInputInfo(ref lii))
                {
                    uint currentTick = GetTickCount();
                    uint diff = currentTick - lii.dwTime;
                    return (int)(diff / 1000);
                }
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Error checking idle time", ex);
            }

            return 0;
        }
    }
}
