using System;
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

            Task.Run(new Func<Task>(HeartbeatLoopAsync));
            Task.Run(new Func<Task>(TelemetryLoopAsync));
        }

        private async void SendHeartbeatOnceAsync()
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
                        _config.Uuid = freshConfig.Uuid;
                        await _backend.SendHeartbeatAsync(_config.ServerUrl, _config.Uuid);
                    }
                }
                catch (Exception ex)
                {
                    Logging.AgentLogger.LogError("Exception in HeartbeatLoop", ex);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds), _cts.Token);
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
                    await Task.Delay(TimeSpan.FromSeconds(_config.TelemetryIntervalSeconds), _cts.Token);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }

        public void Dispose()
        {
            _cts.Cancel();
            _cts.Dispose();
        }
    }
}
