using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.Capture;
using Windows.Media.Capture.Frames;
using Windows.Media.MediaProperties;

namespace MLD.Agent.Cpat
{
    public class CpatCameraManager : IDisposable
    {
        private MediaCapture? _mediaCapture;
        private MediaFrameReader? _frameReader;
        private bool _isCapturing = false;
        private readonly object _syncLock = new object();

        public bool IsCapturing => _isCapturing;

        public async Task<bool> StartSharedCaptureAsync()
        {
            lock (_syncLock)
            {
                if (_isCapturing) return true;
            }

            try
            {
                // Find all video frame source groups
                IReadOnlyList<MediaFrameSourceGroup> frameSourceGroups = await MediaFrameSourceGroup.FindAllAsync();
                var colorGroup = frameSourceGroups.FirstOrDefault(g => 
                    g.SourceInfos.Any(info => info.SourceKind == MediaFrameSourceKind.Color));

                if (colorGroup == null)
                {
                    MldAgent.Logging.AgentLogger.LogWarning("No suitable color camera source group found.");
                    return false;
                }

                var settings = new MediaCaptureInitializationSettings
                {
                    SourceGroup = colorGroup,
                    SharingMode = MediaCaptureSharingMode.SharedReadOnly,
                    MemoryPreference = MediaCaptureMemoryPreference.Cpu,
                    StreamingCaptureMode = StreamingCaptureMode.Video
                };

                _mediaCapture = new MediaCapture();
                await _mediaCapture.InitializeAsync(settings);

                // Identify the color frame source
                MediaFrameSource? colorSource = _mediaCapture.FrameSources.Values
                    .FirstOrDefault(s => s.Info.SourceKind == MediaFrameSourceKind.Color);

                if (colorSource == null)
                {
                    MldAgent.Logging.AgentLogger.LogWarning("MediaCapture color frame source unavailable.");
                    await CleanupAsync();
                    return false;
                }

                _frameReader = await _mediaCapture.CreateFrameReaderAsync(colorSource, MediaEncodingSubtypes.Nv12);
                var status = await _frameReader.StartAsync();

                if (status != MediaFrameReaderStartStatus.Success)
                {
                    MldAgent.Logging.AgentLogger.LogWarning($"MediaFrameReader StartAsync returned: {status}");
                    await CleanupAsync();
                    return false;
                }

                lock (_syncLock)
                {
                    _isCapturing = true;
                }

                MldAgent.Logging.AgentLogger.LogInfo("SharedReadOnly MediaFrameReader capture started successfully.");
                return true;
            }
            catch (UnauthorizedAccessException uex)
            {
                MldAgent.Logging.AgentLogger.LogWarning($"Camera exclusive hardware lock held by meeting software: {uex.Message}");
                await CleanupAsync();
                return false;
            }
            catch (Exception ex)
            {
                MldAgent.Logging.AgentLogger.LogError("Failed to initialize SharedReadOnly MediaCapture", ex);
                await CleanupAsync();
                return false;
            }
        }

        public SoftwareBitmap? TryAcquireLatestFrame()
        {
            if (!_isCapturing || _frameReader == null) return null;

            try
            {
                using (MediaFrameReference? frame = _frameReader.TryAcquireLatestFrame())
                {
                    if (frame?.VideoMediaFrame?.SoftwareBitmap != null)
                    {
                        // Copy reference to memory and return
                        return SoftwareBitmap.Copy(frame.VideoMediaFrame.SoftwareBitmap);
                    }
                }
            }
            catch (Exception ex)
            {
                MldAgent.Logging.AgentLogger.LogWarning($"Error acquiring frame sample: {ex.Message}");
            }

            return null;
        }

        public async Task CleanupAsync()
        {
            lock (_syncLock)
            {
                _isCapturing = false;
            }

            try
            {
                if (_frameReader != null)
                {
                    await _frameReader.StopAsync();
                    _frameReader.Dispose();
                    _frameReader = null;
                }
            }
            catch {}

            try
            {
                if (_mediaCapture != null)
                {
                    _mediaCapture.Dispose();
                    _mediaCapture = null;
                }
            }
            catch {}

            MldAgent.Logging.AgentLogger.LogInfo("Camera resources cleanly released.");
        }

        public void Dispose()
        {
            CleanupAsync().GetAwaiter().GetResult();
        }
    }
}
