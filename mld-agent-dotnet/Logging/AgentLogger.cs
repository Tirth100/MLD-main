using System;
using System.IO;

namespace MldAgent.Logging
{
    public static class AgentLogger
    {
        private static readonly string LogFilePath = Path.Combine(
            Path.GetTempPath(),
            "mld-agent.log"
        );
        private static readonly object LockObj = new object();

        public static void LogInfo(string message)
        {
            WriteLog("INFO", message);
        }

        public static void LogWarning(string message)
        {
            WriteLog("WARN", message);
        }

        public static void LogError(string message, Exception ex = null)
        {
            string fullMsg = ex != null ? string.Format("{0} - Exception: {1}\n{2}", message, ex.Message, ex.StackTrace) : message;
            WriteLog("ERROR", fullMsg);
        }

        public static void LogDebug(string message)
        {
            #if DEBUG
            WriteLog("DEBUG", message);
            #endif
        }

        private static void WriteLog(string level, string message)
        {
            string formatted = string.Format("[{0:yyyy-MM-dd HH:mm:ss.fff}] [{1}] {2}", DateTime.Now, level, message);
            try
            {
                #if DEBUG
                Console.WriteLine(formatted);
                #endif
                lock (LockObj)
                {
                    File.AppendAllText(LogFilePath, formatted + Environment.NewLine);
                }
            }
            catch
            {
                // Never crash background agent on logging
            }
        }
    }
}
