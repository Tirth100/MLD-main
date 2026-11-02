using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace MldAgent.Monitoring
{
    public class AiSignalEvent
    {
        public string Type { get; set; }
        public string ProcessName { get; set; }
        public string WindowTitle { get; set; }
        public string Confidence { get; set; } // HIGH, MEDIUM, LOW
        public string Reason { get; set; }
        public bool IsDirectlyObserved { get; set; }

        public string ToJson()
        {
            return string.Format(
                "{{\"type\":\"{0}\",\"process\":\"{1}\",\"title\":\"{2}\",\"confidence\":\"{3}\",\"reason\":\"{4}\",\"observed\":{5}}}",
                Escape(Type),
                Escape(ProcessName),
                Escape(WindowTitle),
                Escape(Confidence),
                Escape(Reason),
                IsDirectlyObserved ? "true" : "false"
            );
        }

        private static string Escape(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
        }
    }

    public static class AiAssistanceDetector
    {
        // Window Display Affinity constants
        private const uint WDA_NONE = 0x00000000;
        private const uint WDA_MONITOR = 0x00000001;
        private const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;

        // Window style constants
        private const int GWL_EXSTYLE = -20;
        private const int WS_EX_TOPMOST = 0x00000008;
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_TRANSPARENT = 0x00000020;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool GetWindowDisplayAffinity(IntPtr hWnd, out uint dwAffinity);

        [DllImport("user32.dll", EntryPoint = "GetWindowLong")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern int GetWindowTextLength(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr hWnd);

        // Registry of known AI interview copilot process name keywords
        private static readonly string[] ProhibitedCopilotSignatures = new string[]
        {
            "finalround", "interviewcopilot", "invisipilot", "smallbird", "meetassist",
            "applyquick", "stealthinterview", "cluegent", "syntaxcue", "beak",
            "extrabrain", "extramind", "sutra", "seenact", "acedly", "interviewplan",
            "cluely", "interviewcoder", "lockedin", "cheatgpt", "interviewpilot", "jawab"
        };

        // Permitted / General productivity & dev tools (to prevent false-positive over-flagging)
        private static readonly string[] PermittedDevKeywords = new string[]
        {
            "code", "devenv", "idea", "pycharm", "webstorm", "eclipse", "sublime", "notepad++", "terminal", "powershell", "cmd"
        };

        // Rapid context switching tracking
        private static readonly Queue<DateTime> SwitchTimestamps = new Queue<DateTime>();
        private static string _lastTrackedWindow = "";
        private static readonly object DetectorLock = new object();

        public static List<AiSignalEvent> ScanForAiAssistanceSignals(string currentForegroundTitle)
        {
            var detectedSignals = new List<AiSignalEvent>();

            lock (DetectorLock)
            {
                DateTime now = DateTime.UtcNow;

                // 1. Context switching tracking
                if (!string.IsNullOrEmpty(currentForegroundTitle) && !currentForegroundTitle.Equals(_lastTrackedWindow, StringComparison.OrdinalIgnoreCase))
                {
                    _lastTrackedWindow = currentForegroundTitle;
                    SwitchTimestamps.Enqueue(now);
                }

                // Clean switches older than 30 seconds
                while (SwitchTimestamps.Count > 0 && (now - SwitchTimestamps.Peek()).TotalSeconds > 30)
                {
                    SwitchTimestamps.Dequeue();
                }

                // If > 5 rapid window switches within 30s during active session
                if (SwitchTimestamps.Count >= 6)
                {
                    detectedSignals.Add(new AiSignalEvent
                    {
                        Type = "RAPID_CONTEXT_SWITCHING",
                        ProcessName = "Operating System / Windows",
                        WindowTitle = currentForegroundTitle,
                        Confidence = "MEDIUM",
                        Reason = string.Format("Observed {0} rapid application focus transitions within 30 seconds", SwitchTimestamps.Count),
                        IsDirectlyObserved = true
                    });
                }

                // 2. Scan top-level windows for display affinity & stealth overlay signatures
                try
                {
                    EnumWindows(delegate (IntPtr hWnd, IntPtr lParam)
                    {
                        if (!IsWindowVisible(hWnd)) return true;

                        int len = GetWindowTextLength(hWnd);
                        string title = "";
                        if (len > 0)
                        {
                            var sb = new StringBuilder(len + 1);
                            GetWindowText(hWnd, sb, sb.Capacity);
                            title = sb.ToString();
                        }

                        uint processId;
                        GetWindowThreadProcessId(hWnd, out processId);
                        string procName = "";
                        try
                        {
                            using (var proc = Process.GetProcessById((int)processId))
                            {
                                procName = proc.ProcessName.ToLowerInvariant();
                            }
                        }
                        catch { }

                        if (string.IsNullOrEmpty(procName) || procName == "explorer" || procName == "dwm") return true;

                        // Check A: WDA_EXCLUDEFROMCAPTURE (Deliberately hiding window from Zoom/Teams screen shares)
                        uint affinity;
                        if (GetWindowDisplayAffinity(hWnd, out affinity))
                        {
                            if (affinity == WDA_EXCLUDEFROMCAPTURE || affinity == WDA_MONITOR)
                            {
                                // Verify this is not a built-in OS dialog
                                if (!procName.Contains("mld") && !procName.Contains("taskmgr") && !procName.Contains("shellexperiencehost"))
                                {
                                    detectedSignals.Add(new AiSignalEvent
                                    {
                                        Type = "SCREEN_CAPTURE_EVASION",
                                        ProcessName = procName,
                                        WindowTitle = string.IsNullOrEmpty(title) ? "[Excluded Capture Overlay]" : title,
                                        Confidence = "HIGH",
                                        Reason = "Window explicitly configured with WDA_EXCLUDEFROMCAPTURE to hide from meeting screen share",
                                        IsDirectlyObserved = true
                                    });
                                }
                            }
                        }

                        // Check B: Topmost Transparent Layered Overlay (teleprompter signature)
                        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
                        bool isTopmost = (exStyle & WS_EX_TOPMOST) != 0;
                        bool isLayered = (exStyle & WS_EX_LAYERED) != 0;
                        bool isTransparent = (exStyle & WS_EX_TRANSPARENT) != 0;

                        if (isTopmost && isLayered)
                        {
                            // If it matches known copilot or has non-standard transparent overlay
                            foreach (string sig in ProhibitedCopilotSignatures)
                            {
                                if (procName.Contains(sig) || (!string.IsNullOrEmpty(title) && title.ToLowerInvariant().Contains(sig)))
                                {
                                    detectedSignals.Add(new AiSignalEvent
                                    {
                                        Type = "KNOWN_COPILOT_PROCESS",
                                        ProcessName = procName,
                                        WindowTitle = title,
                                        Confidence = "HIGH",
                                        Reason = string.Format("Direct match for known AI interview assistant signature ({0}) with topmost overlay", sig),
                                        IsDirectlyObserved = true
                                    });
                                    break;
                                }
                            }

                            if (isTransparent && !procName.Contains("mld") && !procName.Contains("discord") && !procName.Contains("steam"))
                            {
                                detectedSignals.Add(new AiSignalEvent
                                {
                                    Type = "TRANSPARENT_TOPMOST_OVERLAY",
                                    ProcessName = procName,
                                    WindowTitle = string.IsNullOrEmpty(title) ? "[Borderless Overlay]" : title,
                                    Confidence = "MEDIUM",
                                    Reason = "Observed active borderless transparent click-through overlay window (WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT)",
                                    IsDirectlyObserved = true
                                });
                            }
                        }

                        return true;
                    }, IntPtr.Zero);
                }
                catch (Exception ex)
                {
                    Logging.AgentLogger.LogError("Error in AiAssistanceDetector scan", ex);
                }
            }

            return detectedSignals;
        }
    }
}

