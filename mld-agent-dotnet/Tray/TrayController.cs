using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using MldAgent.Configuration;
using MldAgent.Services;

namespace MldAgent.Tray
{
    public class TrayController : IDisposable
    {
        private readonly NotifyIcon _notifyIcon;
        private readonly AgentConfiguration _config;
        private readonly MenuItem _statusMenuItem;
        private readonly MenuItem _startupMenuItem;

        public ApplicationContext Context { get; private set; }

        public event Action<string> OnTokenUpdated;

        public TrayController(AgentConfiguration config)
        {
            _config = config;

            _notifyIcon = new NotifyIcon
            {
                Text = "MLD Agent - Native Desktop Telemetry",
                Visible = true
            };

            var contextMenu = new ContextMenu();

            var titleItem = new MenuItem("MLD Desktop Agent (v2.0)") { Enabled = false };
            _statusMenuItem = new MenuItem("Status: Initializing...") { Enabled = false };
            
            var openDashItem = new MenuItem("Open Web Dashboard", delegate { OpenDashboard(); });
            var linkItem = new MenuItem("Pair Account Token...", delegate { PromptPairToken(); });
            
            _startupMenuItem = new MenuItem("Launch on Windows Startup", delegate { ToggleStartup(); });
            _startupMenuItem.Checked = WindowsRegistration.IsStartupRunEnabled();

            var exitItem = new MenuItem("Exit Agent", delegate { ExitApplication(); });

            contextMenu.MenuItems.Add(titleItem);
            contextMenu.MenuItems.Add(_statusMenuItem);
            contextMenu.MenuItems.Add("-");
            contextMenu.MenuItems.Add(openDashItem);
            contextMenu.MenuItems.Add(linkItem);
            contextMenu.MenuItems.Add(_startupMenuItem);
            contextMenu.MenuItems.Add("-");
            contextMenu.MenuItems.Add(exitItem);

            _notifyIcon.ContextMenu = contextMenu;
            _notifyIcon.DoubleClick += delegate { OpenDashboard(); };

            UpdateTrayState(false, "Standing by");

            Context = new ApplicationContext();
        }

        public void UpdateTrayState(bool isMonitoring, string statusDetail)
        {
            if (_notifyIcon == null) return;

            try
            {
                Color dotColor;
                if (string.IsNullOrEmpty(_config.Uuid))
                {
                    dotColor = Color.FromArgb(239, 68, 68); // Red
                    _notifyIcon.Text = "MLD Agent: Unlinked (Please pair from dashboard)";
                    _statusMenuItem.Text = "Status: Unlinked";
                }
                else if (isMonitoring)
                {
                    dotColor = Color.FromArgb(34, 197, 94); // Green
                    string text = string.Format("MLD Agent: Monitoring ({0})", statusDetail);
                    if (text.Length > 63) text = text.Substring(0, 60) + "...";
                    _notifyIcon.Text = text;
                    _statusMenuItem.Text = string.Format("Status: Active ({0})", statusDetail);
                }
                else
                {
                    dotColor = Color.FromArgb(156, 163, 175); // Gray
                    _notifyIcon.Text = "MLD Agent: Standby";
                    _statusMenuItem.Text = string.Format("Status: {0}", statusDetail);
                }

                _notifyIcon.Icon = CreateTrayIcon(dotColor);
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Failed to update tray state", ex);
            }
        }

        public void ShowNotification(string title, string message, ToolTipIcon icon)
        {
            try
            {
                _notifyIcon.ShowBalloonTip(3000, title, message, icon);
            }
            catch
            {
                // Ignore balloon tip failure
            }
        }

        private void OpenDashboard()
        {
            try
            {
                string url = !string.IsNullOrEmpty(_config.ServerUrl) ? _config.ServerUrl : "https://mld-main.onrender.com";
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = url,
                    UseShellExecute = true
                });
            }
            catch (Exception ex)
            {
                Logging.AgentLogger.LogError("Failed to open dashboard URL", ex);
            }
        }

        private void PromptPairToken()
        {
            string currentToken = _config.Uuid ?? "";
            string prompt = Microsoft.VisualBasic.Interaction.InputBox(
                "Enter your Employee Account Pairing Token (UUID):",
                "Pair MLD Agent Account",
                currentToken
            );

            if (!string.IsNullOrEmpty(prompt) && !prompt.Trim().Equals(currentToken))
            {
                _config.UpdateToken(prompt.Trim());
                if (OnTokenUpdated != null)
                {
                    OnTokenUpdated(prompt.Trim());
                }
                ShowNotification("Account Paired", "MLD Agent successfully paired with token.", ToolTipIcon.Info);
                UpdateTrayState(false, "Paired & Standing by");
            }
        }

        private void ToggleStartup()
        {
            bool currentState = WindowsRegistration.IsStartupRunEnabled();
            bool newState = !currentState;
            WindowsRegistration.SetStartupRun(newState);
            _startupMenuItem.Checked = newState;
        }

        private void ExitApplication()
        {
            _notifyIcon.Visible = false;
            Context.ExitThread();
            Application.Exit();
        }

        private static Icon CreateTrayIcon(Color dotColor)
        {
            using (var bmp = new Bitmap(16, 16))
            using (var g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.Clear(Color.Transparent);

                using (var outerBrush = new SolidBrush(Color.FromArgb(40, Color.Black)))
                {
                    g.FillEllipse(outerBrush, 1, 1, 14, 14);
                }

                using (var brush = new SolidBrush(dotColor))
                {
                    g.FillEllipse(brush, 2, 2, 12, 12);
                }

                using (var highlightBrush = new SolidBrush(Color.FromArgb(120, Color.White)))
                {
                    g.FillEllipse(highlightBrush, 4, 3, 5, 4);
                }

                IntPtr hIcon = bmp.GetHicon();
                return Icon.FromHandle(hIcon);
            }
        }

        public void Dispose()
        {
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
        }
    }
}
