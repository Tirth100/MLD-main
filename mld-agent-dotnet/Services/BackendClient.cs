using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace MldAgent.Services
{
    public class SessionStatus
    {
        public bool IsActive { get; set; }
        public string SessionCode { get; set; }
    }

    public class BackendClient
    {
        private static readonly List<string> OfflineQueue = new List<string>();
        private static readonly object QueueLock = new object();
        private const int MaxOfflineQueueSize = 500;

        static BackendClient()
        {
            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 
                    | (SecurityProtocolType)3072 // Tls13
                    | SecurityProtocolType.Tls11;
                ServicePointManager.DefaultConnectionLimit = 20;
            }
            catch
            {
                // Ignore TLS config fallback
            }
        }

        public async Task<bool> SendHeartbeatAsync(string baseUrl, string uuid)
        {
            if (string.IsNullOrEmpty(uuid)) return false;

            string endpoint = CombineUrl(baseUrl, "/api/heartbeat");
            string payload = string.Format("{{\"uuid\": \"{0}\"}}", EscapeJson(uuid));

            try
            {
                await PostJsonAsync(endpoint, payload, uuid);
                return true;
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogWarning(string.Format("Heartbeat failed to {0}: {1}", endpoint, ex.Message));
                return false;
            }
        }

        public async Task<SessionStatus> GetActiveSessionAsync(string baseUrl, string uuid)
        {
            var result = new SessionStatus { IsActive = false, SessionCode = null };
            if (string.IsNullOrEmpty(uuid)) return result;

            string endpoint = CombineUrl(baseUrl, string.Format("/api/active-session?uuid={0}", Uri.EscapeDataString(uuid)));
            try
            {
                string json = await GetStringAsync(endpoint);
                result.IsActive = json.Contains("\"active\":true") || json.Contains("\"active\": true");
                result.SessionCode = ExtractJsonString(json, "sessionCode");
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogWarning(string.Format("GetActiveSession failed: {0}", ex.Message));
            }

            return result;
        }

        public async Task<bool> SendTelemetryTickAsync(string baseUrl, string uuid, string sessionCode, string window, bool webcam, int idleSeconds)
        {
            string payload = BuildTelemetryJson(uuid, sessionCode, window, webcam, idleSeconds);
            string endpoint = CombineUrl(baseUrl, "/api/track");

            try
            {
                string response = await PostJsonAsync(endpoint, payload, uuid);
                if (response.Contains("\"active\":false") || response.Contains("\"active\": false"))
                {
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogWarning(string.Format("Telemetry failed to send: {0}. Queuing offline.", ex.Message));
                QueueOfflinePayload(payload);
                return true;
            }
        }

        public void QueueOfflinePayload(string payload)
        {
            lock (QueueLock)
            {
                OfflineQueue.Add(payload);
                if (OfflineQueue.Count > MaxOfflineQueueSize)
                {
                    OfflineQueue.RemoveAt(0);
                }
            }
        }

        public async Task FlushOfflineQueueAsync(string baseUrl, string uuid)
        {
            List<string> itemsToSend;
            lock (QueueLock)
            {
                if (OfflineQueue.Count == 0) return;
                itemsToSend = new List<string>(OfflineQueue);
            }

            string endpoint = CombineUrl(baseUrl, "/api/track");
            var sentItems = new List<string>();

            foreach (var item in itemsToSend)
            {
                try
                {
                    await PostJsonAsync(endpoint, item, uuid);
                    sentItems.Add(item);
                }
                catch
                {
                    break;
                }
            }

            lock (QueueLock)
            {
                foreach (var sent in sentItems)
                {
                    OfflineQueue.Remove(sent);
                }
            }
        }

        private static string BuildTelemetryJson(string uuid, string sessionCode, string window, bool webcam, int idleSeconds)
        {
            return string.Format(
                "{{\"uuid\":\"{0}\",\"sessionCode\":\"{1}\",\"window\":\"{2}\",\"webcam\":{3},\"idle\":{4}}}",
                EscapeJson(uuid),
                EscapeJson(sessionCode),
                EscapeJson(window),
                webcam ? "true" : "false",
                idleSeconds
            );
        }

        private static async Task<string> PostJsonAsync(string url, string jsonBody, string token)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "POST";
            request.ContentType = "application/json; charset=utf-8";
            request.Timeout = 8000;
            request.ReadWriteTimeout = 8000;
            request.UserAgent = "MLD-Agent/2.0 (Windows NT; x64)";

            if (!string.IsNullOrEmpty(token))
            {
                request.Headers["Authorization"] = "Bearer " + token;
            }

            byte[] bytes = Encoding.UTF8.GetBytes(jsonBody);
            request.ContentLength = bytes.Length;

            using (Stream requestStream = await request.GetRequestStreamAsync())
            {
                await requestStream.WriteAsync(bytes, 0, bytes.Length);
            }

            using (var response = (HttpWebResponse)await request.GetResponseAsync())
            using (var stream = response.GetResponseStream())
            using (var reader = new StreamReader(stream, Encoding.UTF8))
            {
                return await reader.ReadToEndAsync();
            }
        }

        private static async Task<string> GetStringAsync(string url)
        {
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Method = "GET";
            request.Timeout = 8000;
            request.ReadWriteTimeout = 8000;
            request.UserAgent = "MLD-Agent/2.0 (Windows NT; x64)";

            using (var response = (HttpWebResponse)await request.GetResponseAsync())
            using (var stream = response.GetResponseStream())
            using (var reader = new StreamReader(stream, Encoding.UTF8))
            {
                return await reader.ReadToEndAsync();
            }
        }

        private static string CombineUrl(string baseUrl, string relative)
        {
            if (string.IsNullOrEmpty(baseUrl)) baseUrl = "https://mld-server.onrender.com";
            return baseUrl.TrimEnd('/') + "/" + relative.TrimStart('/');
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\", "\\\\")
                    .Replace("\"", "\\\"")
                    .Replace("\r", "\\r")
                    .Replace("\n", "\\n")
                    .Replace("\t", "\\t");
        }

        private static string ExtractJsonString(string json, string key)
        {
            int keyIdx = json.IndexOf(string.Format("\"{0}\"", key), StringComparison.OrdinalIgnoreCase);
            if (keyIdx < 0) return null;

            int colonIdx = json.IndexOf(':', keyIdx);
            if (colonIdx < 0) return null;

            int firstQuote = json.IndexOf('\"', colonIdx);
            if (firstQuote < 0) return null;

            int secondQuote = json.IndexOf('\"', firstQuote + 1);
            if (secondQuote < 0) return null;

            return json.Substring(firstQuote + 1, secondQuote - firstQuote - 1);
        }
    }
}
