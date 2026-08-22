using System;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using MldAgent.Configuration;
using MldAgent.Monitoring;
using MldAgent.Tray;

namespace MldAgent.Services
{
    public class AgentApplication : IDisposable
    {
        private readonly AgentConfiguration _config;
        private readonly TrayController _tray;
        private readonly BackendClient _backend;
        private readonly CancellationTokenSource _cts;

        private bool _isMonitoring;
        private string _currentSessionCode;
        private HttpListener _localHttpListener;

        public AgentApplication(AgentConfiguration config, TrayController tray)
        {
            _config = config;
            _tray = tray;
            _backend = new BackendClient();
            _cts = new CancellationTokenSource();
            _isMonitoring = false;
            _currentSessionCode = null;

            _tray.OnTokenUpdated += delegate(string token)
            {
                _config.UpdateToken(token);
                SendHeartbeatOnceAsync();
            };
        }

        public void Start()
        {
            Logging.AgentLogger.LogInfo("Starting MLD Agent background workers...");

            WindowsRegistration.RegisterUrlProtocol();

            // Start local ping server for instant local detection
            StartLocalPingServer();

            // Send immediate first heartbeat on start
            SendHeartbeatOnceAsync();

            Task.Run(new Func<Task>(HeartbeatLoopAsync));
            Task.Run(new Func<Task>(TelemetryLoopAsync));
        }

        private System.Net.Sockets.TcpListener _localTcpListener;

        private void StartLocalPingServer()
        {
            try
            {
                _localTcpListener = new System.Net.Sockets.TcpListener(IPAddress.Loopback, 14321);
                _localTcpListener.Start();
                Logging.AgentLogger.LogInfo("Local TCP ping listener started on 127.0.0.1:14321");

                Task.Run(delegate
                {
                    while (!_cts.IsCancellationRequested)
                    {
                        try
                        {
                            var client = _localTcpListener.AcceptTcpClient();
                            Task.Run(delegate
                            {
                                try
                                {
                                    using (client)
                                    using (var stream = client.GetStream())
                                    {
                                        byte[] reqBuf = new byte[1024];
                                        stream.Read(reqBuf, 0, reqBuf.Length);

                                        string json = string.Format("{{\"status\":\"ok\",\"uuid\":\"{0}\",\"service\":\"MLD-Agent\"}}", _config.Uuid ?? "");
                                        byte[] jsonBytes = Encoding.UTF8.GetBytes(json);

                                        string response = "HTTP/1.1 200 OK\r\n" +
                                                          "Content-Type: application/json; charset=utf-8\r\n" +
                                                          "Access-Control-Allow-Origin: *\r\n" +
                                                          "Access-Control-Allow-Methods: GET, OPTIONS\r\n" +
                                                          "Access-Control-Allow-Headers: *\r\n" +
                                                          string.Format("Content-Length: {0}\r\n\r\n", jsonBytes.Length) +
                                                          json;

                                        byte[] respBytes = Encoding.UTF8.GetBytes(response);
                                        stream.Write(respBytes, 0, respBytes.Length);
                                    }
                                }
                                catch {}
                            });
                        }
                        catch
                        {
                            break;
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogWarning(string.Format("Could not start local TCP ping server on 14321: {0}", ex.Message));
            }
        }

        public async void SendHeartbeatOnceAsync()
        {
            if (string.IsNullOrEmpty(_config.Uuid)) return;
            try
            {
                await _backend.SendHeartbeatAsync(_config.ServerUrl, _config.Uuid);
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Heartbeat tick failed", ex);
            }
        }

        private async Task HeartbeatLoopAsync()
        {
            while (!_cts.IsCancellationRequested)
            {
                try
                {
                    var freshConfig = AgentConfiguration.Load();
                    if (!string.IsNullOrEmpty(freshConfig.Uuid))
                    {
                        bool wasDifferent = _config.Uuid != freshConfig.Uuid;
                        _config.Uuid = freshConfig.Uuid;
                        if (wasDifferent)
                        {
                            _tray.UpdateTrayState(false, "Paired & Standing by");
                        }
                        await _backend.SendHeartbeatAsync(_config.ServerUrl, _config.Uuid);
                    }
                }
                catch (Exception ex)
                {
                    Logging.AgentLogger.LogError("Exception in HeartbeatLoop", ex);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(15), _cts.Token);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }

        private async Task TelemetryLoopAsync()
        {
            while (!_cts.IsCancellationRequested)
            {
                try
                {
                    // Periodically check if token was updated on disk by URL protocol trigger
                    var freshConfig = AgentConfiguration.Load();
                    if (!string.IsNullOrEmpty(freshConfig.Uuid) && _config.Uuid != freshConfig.Uuid)
                    {
                        _config.Uuid = freshConfig.Uuid;
                        _tray.UpdateTrayState(false, "Paired & Standing by");
                        _tray.ShowNotification("Account Paired", "MLD Agent successfully linked with token.", ToolTipIcon.Info);
                        await _backend.SendHeartbeatAsync(_config.ServerUrl, _config.Uuid);
                    }

                    if (string.IsNullOrEmpty(_config.Uuid))
                    {
                        _tray.UpdateTrayState(false, "Unlinked - Please pair from dashboard");
                    }
                    else
                    {
                        var status = await _backend.GetActiveSessionAsync(_config.ServerUrl, _config.Uuid);

                        if (status.IsActive && !string.IsNullOrEmpty(status.SessionCode))
                        {
                            if (!_isMonitoring || !_currentSessionCode.Equals(status.SessionCode, StringComparison.OrdinalIgnoreCase))
                            {
                                _currentSessionCode = status.SessionCode;
                                _isMonitoring = true;
                                _tray.UpdateTrayState(true, _currentSessionCode);
                                _tray.ShowNotification("Meeting Monitoring Active", string.Format("Joined telemetry session: {0}", _currentSessionCode), ToolTipIcon.Info);
                                await _backend.FlushOfflineQueueAsync(_config.ServerUrl, _config.Uuid);
                            }

                            string windowTitle = WindowsActivityMonitor.GetActiveWindowTitle();
                            bool webcamActive = WindowsActivityMonitor.IsWebcamActive();
                            int idleSeconds = WindowsActivityMonitor.GetIdleSeconds();

                            bool sessionStillOpen = await _backend.SendTelemetryTickAsync(
                                _config.ServerUrl,
                                _config.Uuid,
                                _currentSessionCode,
                                windowTitle,
                                webcamActive,
                                idleSeconds
                            );

                            if (!sessionStillOpen)
                            {
                                _isMonitoring = false;
                                _currentSessionCode = null;
                                _tray.UpdateTrayState(false, "Session concluded");
                            }
                        }
                        else
                        {
                            if (_isMonitoring)
                            {
                                _isMonitoring = false;
                                _currentSessionCode = null;
                                _tray.UpdateTrayState(false, "Standing by");
                                _tray.ShowNotification("Meeting Ended", "Session telemetry completed. Agent is in standby mode.", ToolTipIcon.Info);
                            }
                            else
                            {
                                _tray.UpdateTrayState(false, "Standing by");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Logging.AgentLogger.LogError("Exception in TelemetryLoop", ex);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), _cts.Token);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }

        public void Dispose()
        {
            try
            {
                if (_localHttpListener != null && _localHttpListener.IsListening)
                {
                    _localHttpListener.Stop();
                    _localHttpListener.Close();
                }
            }
            catch {}

            _cts.Cancel();
            _cts.Dispose();
        }
    }
}
