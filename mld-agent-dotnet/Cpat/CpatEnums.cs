namespace MLD.Agent.Cpat
{
    public enum CpatCameraState
    {
        Disabled,
        SessionInactive,
        MeetingCameraOff,
        TrackingActive,
        ExclusiveCameraInUse,
        PausedByUser
    }

    public enum AttentionVerdict
    {
        Unknown,
        Focused,
        Distracted,
        CameraOff
    }
}
