using System;
using System.Collections.Generic;

namespace MLD.Agent.Cpat
{
    public class CpatState
    {
        private readonly object _lock = new object();
        private readonly Queue<bool> _faceHistory = new Queue<bool>();
        private const int HistoryWindowSize = 5;

        public CpatCameraState CameraState { get; private set; } = CpatCameraState.Disabled;
        public AttentionVerdict Verdict { get; private set; } = AttentionVerdict.Unknown;
        public bool IsFacingScreen { get; private set; } = true;
        public int ConsecutiveDistractedSeconds { get; private set; } = 0;
        public string StatusDescription { get; private set; } = "Initialized";
        public DateTime LastSampleTime { get; private set; } = DateTime.MinValue;

        public void UpdateState(CpatCameraState camState, bool? rawFaceDetected, int sampleIntervalSec, int distractionThresholdSec, string description)
        {
            lock (_lock)
            {
                CameraState = camState;
                StatusDescription = description;
                LastSampleTime = DateTime.UtcNow;

                if (camState != CpatCameraState.TrackingActive || !rawFaceDetected.HasValue)
                {
                    _faceHistory.Clear();
                    ConsecutiveDistractedSeconds = 0;
                    if (camState == CpatCameraState.MeetingCameraOff)
                    {
                        Verdict = AttentionVerdict.CameraOff;
                        IsFacingScreen = false;
                    }
                    else
                    {
                        Verdict = AttentionVerdict.Unknown;
                        IsFacingScreen = true;
                    }
                    return;
                }

                // Push raw sample into majority-vote history buffer
                _faceHistory.Enqueue(rawFaceDetected.Value);
                while (_faceHistory.Count > HistoryWindowSize)
                {
                    _faceHistory.Dequeue();
                }

                // Majority-vote evaluation (requires >= 3 of last 5 samples to establish state)
                int positiveSamples = 0;
                foreach (bool sample in _faceHistory)
                {
                    if (sample) positiveSamples++;
                }

                bool majorityFacePresent = positiveSamples >= 3;

                if (majorityFacePresent)
                {
                    ConsecutiveDistractedSeconds = 0;
                    Verdict = AttentionVerdict.Focused;
                    IsFacingScreen = true;
                }
                else
                {
                    ConsecutiveDistractedSeconds += sampleIntervalSec;
                    if (ConsecutiveDistractedSeconds >= distractionThresholdSec)
                    {
                        Verdict = AttentionVerdict.Distracted;
                        IsFacingScreen = false;
                    }
                    else
                    {
                        // Within grace threshold; retain previous verdict to avoid false spikes
                        Verdict = AttentionVerdict.Focused;
                        IsFacingScreen = true;
                    }
                }
            }
        }

        public void Reset()
        {
            lock (_lock)
            {
                CameraState = CpatCameraState.SessionInactive;
                Verdict = AttentionVerdict.Unknown;
                IsFacingScreen = true;
                ConsecutiveDistractedSeconds = 0;
                StatusDescription = "Standby";
                _faceHistory.Clear();
            }
        }
    }
}
