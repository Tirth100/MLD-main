using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using Microsoft.Win32;

namespace MldAgent.Services
{
    public static class WindowsRegistration
    {
        private const string ProtocolScheme = "mld-agent";
        private const string AppName = "MLD-Agent";

        public static void RegisterUrlProtocol()
        {
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule != null 
                    ? Process.GetCurrentProcess().MainModule.FileName 
                    : Assembly.GetExecutingAssembly().Location;

                if (string.IsNullOrEmpty(exePath) || !File.Exists(exePath))
                {
                    return;
                }

                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(string.Format(@"Software\Classes\{0}", ProtocolScheme)))
                {
                    if (key != null)
                    {
                        key.SetValue("", "URL:MLD Agent Protocol");
                        key.SetValue("URL Protocol", "");

                        using (RegistryKey defaultIcon = key.CreateSubKey("DefaultIcon"))
                        {
                            if (defaultIcon != null) defaultIcon.SetValue("", string.Format("\"{0}\",0", exePath));
                        }

                        using (RegistryKey commandKey = key.CreateSubKey(@"shell\open\command"))
                        {
                            if (commandKey != null) commandKey.SetValue("", string.Format("\"{0}\" \"%1\"", exePath));
                        }

                        Logging.AgentLogger.LogInfo("Custom URI protocol 'mld-agent://' registered successfully.");
                    }
                }
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Failed to register URL protocol in registry", ex);
            }
        }

        public static void SetStartupRun(bool enable)
        {
            try
            {
                string exePath = Process.GetCurrentProcess().MainModule != null 
                    ? Process.GetCurrentProcess().MainModule.FileName 
                    : Assembly.GetExecutingAssembly().Location;

                using (RegistryKey runKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                {
                    if (runKey != null)
                    {
                        if (enable && !string.IsNullOrEmpty(exePath))
                        {
                            runKey.SetValue(AppName, string.Format("\"{0}\"", exePath));
                            Logging.AgentLogger.LogInfo("Windows startup run entry enabled.");
                        }
                        else
                        {
                            runKey.DeleteValue(AppName, false);
                            Logging.AgentLogger.LogInfo("Windows startup run entry removed.");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Failed to modify Windows startup run entry", ex);
            }
        }

        public static bool IsStartupRunEnabled()
        {
            try
            {
                using (RegistryKey runKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", false))
                {
                    return runKey != null && runKey.GetValue(AppName) != null;
                }
            }
            catch
            {
                return false;
            }
        }

        public static string ExtractTokenFromProtocolUrl(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;
            url = url.Trim();

            string tokenPrefix = "token=";
            int idx = url.IndexOf(tokenPrefix, StringComparison.OrdinalIgnoreCase);
            if (idx >= 0)
            {
                string token = url.Substring(idx + tokenPrefix.Length);
                int ampIdx = token.IndexOf('&');
                if (ampIdx >= 0) token = token.Substring(0, ampIdx);
                return token.TrimEnd('/');
            }

            return null;
        }
    }
}
