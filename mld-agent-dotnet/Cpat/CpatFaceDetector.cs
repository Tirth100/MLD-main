using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.FaceAnalysis;

namespace MLD.Agent.Cpat
{
    public class CpatFaceDetector : IDisposable
    {
        private FaceDetector? _detector;
        private bool _isInitializing = false;
        private readonly object _initLock = new object();

        public async Task<bool> InitializeAsync()
        {
            if (_detector != null) return true;

            lock (_initLock)
            {
                if (_isInitializing) return false;
                _isInitializing = true;
            }

            try
            {
                if (!FaceDetector.IsSupported)
                {
                    MldAgent.Logging.AgentLogger.LogWarning("Windows.Media.FaceAnalysis.FaceDetector is not supported on this Windows build.");
                    return false;
                }

                _detector = await FaceDetector.CreateAsync();
                MldAgent.Logging.AgentLogger.LogInfo("Native Windows FaceDetector initialized successfully.");
                return true;
            }
            catch (Exception ex)
            {
                MldAgent.Logging.AgentLogger.LogError("Failed to initialize Windows FaceDetector", ex);
                return false;
            }
            finally
            {
                lock (_initLock)
                {
                    _isInitializing = false;
                }
            }
        }

        public async Task<bool> DetectFrontalFacePresentAsync(SoftwareBitmap bitmap)
        {
            if (_detector == null)
            {
                bool ok = await InitializeAsync();
                if (!ok || _detector == null) return true; // Fail-safe: assume present if detector unavailable
            }

            try
            {
                // Ensure bitmap is in supported pixel format (Gray8 or Nv12)
                SoftwareBitmap convertedBitmap = bitmap;
                bool needsDispose = false;

                if (bitmap.BitmapPixelFormat != BitmapPixelFormat.Gray8 && bitmap.BitmapPixelFormat != BitmapPixelFormat.Nv12)
                {
                    convertedBitmap = SoftwareBitmap.Convert(bitmap, BitmapPixelFormat.Gray8);
                    needsDispose = true;
                }

                try
                {
                    IList<DetectedFace> faces = await _detector.DetectFacesAsync(convertedBitmap);
                    return faces != null && faces.Count > 0;
                }
                finally
                {
                    if (needsDispose)
                    {
                        convertedBitmap.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                MldAgent.Logging.AgentLogger.LogError("Error during face detection sample", ex);
                return true; // Fail-safe: avoid false punishment on sample error
            }
        }

        public void Dispose()
        {
            _detector = null;
        }
    }
}
