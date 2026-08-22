using System;
using System.Threading;
using System.Windows.Forms;
using MldAgent.Configuration;
using MldAgent.Logging;
using MldAgent.Services;
using MldAgent.Tray;

namespace MldAgent
{
    internal static class Program
    {
        private const string MutexName = "Global\\MLD_Desktop_Agent_SingleInstance_Mutex";

        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            AgentLogger.LogInfo(string.Format("MLD Agent starting up. Arguments: {0}", string.Join(" ", args)));

            var config = AgentConfiguration.Load();

            HandleArguments(args, config);

            bool isOnlyInstance;
            using (var mutex = new Mutex(true, MutexName, out isOnlyInstance))
            {
                if (!isOnlyInstance)
                {
                    AgentLogger.LogInfo("Another instance of MLD-Agent is already active. Config updated & exiting new launcher process.");
                    return;
                }

                try
                {
                    using (var tray = new TrayController(config))
                    using (var agentApp = new AgentApplication(config, tray))
                    {
                        agentApp.Start();

                        if (!string.IsNullOrEmpty(config.Uuid))
                        {
                            tray.ShowNotification(
                                "MLD Agent Active",
                                "Connected and standing by in your Windows taskbar system tray.",
                                ToolTipIcon.Info
                            );
                        }
                        else
                        {
                            tray.ShowNotification(
                                "MLD Agent Ready",
                                "Please link your employee account from the web dashboard.",
                                ToolTipIcon.Warning
                            );
                        }

                        Application.Run(tray.Context);
                    }
                }
                catch (Exception ex)
                {
                    AgentLogger.LogError("Fatal crash in MLD Agent application loop", ex);
                    MessageBox.Show(
                        string.Format("MLD Agent encountered an unexpected error:\n\n{0}\n\nPlease check log at %TEMP%\\mld-agent.log", ex.Message),
                        "MLD Agent Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                finally
                {
                    mutex.ReleaseMutex();
                }
            }
        }

        private static void HandleArguments(string[] args, AgentConfiguration config)
        {
            if (args == null || args.Length == 0) return;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (string.IsNullOrEmpty(arg) || string.IsNullOrEmpty(arg.Trim())) continue;

                if (arg.StartsWith("mld-agent:", StringComparison.OrdinalIgnoreCase))
                {
                    string token = WindowsRegistration.ExtractTokenFromProtocolUrl(arg);
                    if (!string.IsNullOrEmpty(token))
                    {
                        config.UpdateToken(token);
                        AgentLogger.LogInfo(string.Format("Account linked via protocol URL with token: {0}", token));
                    }
                }
                else if (arg.Equals("--token", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    string token = args[++i];
                    config.UpdateToken(token);
                    AgentLogger.LogInfo(string.Format("Account linked via --token CLI with: {0}", token));
                }
                else if (arg.Equals("--server", StringComparison.OrdinalIgnoreCase) && i + 1 < args.Length)
                {
                    config.ServerUrl = args[++i];
                    config.Save();
                }
            }
        }
    }
}
