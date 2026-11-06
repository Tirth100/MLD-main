namespace MLD.Agent.Cpat
{
    public class CpatConfiguration
    {
        public bool Enabled { get; set; } = false;
        public int SampleIntervalSeconds { get; set; } = 2;
        public int DistractionThresholdSeconds { get; set; } = 8;
        public int GracePeriodSeconds { get; set; } = 30;
        public int PromptCooldownSeconds { get; set; } = 180;
        public int MaxPromptsPerSession { get; set; } = 2;
        public bool AllowPrompt { get; set; } = true;

        public static CpatConfiguration Default => new CpatConfiguration();
    }
}

