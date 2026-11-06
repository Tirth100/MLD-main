using System;
using System.Threading;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using MldAgent.Configuration;
using MldAgent.Logging;
using MldAgent.Monitoring;

namespace MLD.Agent.Cpat
{
    public class CpatService : IDisposable
    {
        private readonly AgentConfiguration _agentConfig;
        private readonly CpatConfiguration _cpatConfig;
        private readonly CpatState _state;
        private readonly CpatCameraManager _cameraManager;
        private readonly CpatFaceDetector _faceDetector;

        private CancellationTokenSource? _cts;
        private Task? _workerTask;
        private bool _isMonitoring = false;
        private string? _currentSessionCode = null;

        private DateTime _sessionStartTime = DateTime.MinValue;
        private DateTime _lastPromptTime = DateTime.MinValue;
        private int _promptsSentThisSession = 0;
        private bool _isPausedByUser = false;

        public CpatState CurrentState => _state;
        public bool IsPaused => _isPausedByUser;

        public CpatService(AgentConfiguration agentConfig, CpatConfiguration? cpatConfig = null)
        {
            _agentConfig = agentConfig;
            _cpatConfig = cpatConfig ?? CpatConfiguration.Default;
            _state = new CpatState();
            _cameraManager = new CpatCameraManager();
            _faceDetector = new CpatFaceDetector();
        }

        public void Start()
        {
            if (!_agentConfig.CpatEnabled && !_cpatConfig.Enabled)
            {
                AgentLogger.LogInfo("CPAT (Camera Attention Tracking) is disabled by configuration.");
                return;
            }

            _cts = new CancellationTokenSource();
            _workerTask = Task.Run(() => WorkerLoopAsync(_cts.Token));
            AgentLogger.LogInfo("CPAT worker loop started.");
        }

        public void OnSessionStarted(string sessionCode)
        {
            _currentSessionCode = sessionCode;
            _isMonitoring = true;
            _sessionStartTime = DateTime.UtcNow;
            _promptsSentThisSession = 0;
            _lastPromptTime = DateTime.MinValue;
            _isPausedByUser = false;
            _state.Reset();

            AgentLogger.LogInfo($"CPAT activated for session {sessionCode}.");
        }

        public void OnSessionEnded()
        {
            _isMonitoring = false;
            _currentSessionCode = null;
            _state.Reset();

            // Immediately release camera hardware
            Task.Run(async () => await _cameraManager.CleanupAsync());
            AgentLogger.LogInfo("CPAT deactivated for session end. Camera released.");
        }

        public void ToggleUserPause(bool pause)
        {
            _isPausedByUser = pause;
            if (pause)
            {
                Task.Run(async () => await _cameraManager.CleanupAsync());
                _state.UpdateState(CpatCameraState.PausedByUser, null, _cpatConfig.SampleIntervalSeconds, _cpatConfig.DistractionThresholdSeconds, "Paused by user");
            }
            AgentLogger.LogInfo($"CPAT user pause toggled: {pause}");
        }

        private async Task WorkerLoopAsync(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    if (!_isMonitoring || string.IsNullOrEmpty(_currentSessionCode) || _isPausedByUser)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(2), token);
                        continue;
                    }

                    // 1. Check if external meeting software (Zoom/Teams/Meet) currently holds the camera
                    bool isMeetingCameraOn = WindowsActivityMonitor.IsWebcamActive();

                    if (!isMeetingCameraOn)
                    {
                        // Meeting camera is OFF
                        if (_cameraManager.IsCapturing)
                        {
                            await _cameraManager.CleanupAsync();
                        }

                        _state.UpdateState(
                            CpatCameraState.MeetingCameraOff,
                            null,
                            _cpatConfig.SampleIntervalSeconds,
                            _cpatConfig.DistractionThresholdSeconds,
                            "Meeting camera is off"
                        );

                        // Check prompt eligibility with grace period and rate-limiting
                        CheckAndTriggerCameraPrompt();
                    }
                    else
                    {
                        // Meeting camera is ON. Attempt SharedReadOnly capture to analyze frontal attention
                        if (!_cameraManager.IsCapturing)
                        {
                            bool captureStarted = await _cameraManager.StartSharedCaptureAsync();
                            if (!captureStarted)
                            {
                                // Hardware locked exclusively by driver. Graceful fallback: trust meeting camera without error
                                _state.UpdateState(
                                    CpatCameraState.ExclusiveCameraInUse,
                                    true, // Trust presence since meeting camera is verified active
                                    _cpatConfig.SampleIntervalSeconds,
                                    _cpatConfig.DistractionThresholdSeconds,
                                    "Meeting camera active (Exclusive mode)"
                                );
                                await Task.Delay(TimeSpan.FromSeconds(_cpatConfig.SampleIntervalSeconds), token);
                                continue;
                            }
                        }

                        // Acquire single frame in memory
                        SoftwareBitmap? frame = _cameraManager.TryAcquireLatestFrame();
                        if (frame != null)
                        {
                            try
                            {
                                bool faceDetected = await _faceDetector.DetectFrontalFacePresentAsync(frame);

                                _state.UpdateState(
                                    CpatCameraState.TrackingActive,
                                    faceDetected,
                                    _cpatConfig.SampleIntervalSeconds,
                                    _cpatConfig.DistractionThresholdSeconds,
                                    faceDetected ? "Frontal face present" : "Looking away or face obscured"
                                );
                            }
                            finally
                            {
                                frame.Dispose(); // Memory-only: frame is instantly discarded
                            }
                        }
                    }
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    AgentLogger.LogError("Exception in CPAT worker loop", ex);
                }

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(_cpatConfig.SampleIntervalSeconds), token);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
            }
        }

        private void CheckAndTriggerCameraPrompt()
        {
            if (!_cpatConfig.AllowPrompt) return;

            DateTime now = DateTime.UtcNow;

            // 1. Grace period: Wait at least GracePeriodSeconds after joining before first prompt
            if ((now - _sessionStartTime).TotalSeconds < _cpatConfig.GracePeriodSeconds)
            {
                return;
            }

            // 2. Max prompts per session check
            if (_promptsSentThisSession >= _cpatConfig.MaxPromptsPerSession)
            {
                return;
            }

            // 3. Cooldown check between consecutive prompts
            if (_lastPromptTime != DateTime.MinValue && (now - _lastPromptTime).TotalSeconds < _cpatConfig.PromptCooldownSeconds)
            {
                return;
            }

            _promptsSentThisSession++;
            _lastPromptTime = now;

            AgentLogger.LogInfo($"Triggering camera prompt #{_promptsSentThisSession} for session {_currentSessionCode}.");
            CpatPromptWindow.ShowPrompt("Your meeting camera is turned off. Please enable your camera for attendance.");
        }

        public void Dispose()
        {
            _cts?.Cancel();
            _cameraManager.Dispose();
            _faceDetector.Dispose();
        }
    }
}

