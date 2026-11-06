using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace MLD.Agent.Cpat
{
    public class CpatPromptWindow : Form
    {
        private readonly System.Windows.Forms.Timer _fadeTimer;
        private int _ticksRemaining = 60; // 6 seconds at 100ms interval

        public CpatPromptWindow(string message)
        {
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            Width = 360;
            Height = 70;
            BackColor = Color.FromArgb(15, 23, 42); // Deep Slate Navy
            Opacity = 0.95;

            // Rounded borders
            var path = new GraphicsPath();
            path.AddArc(0, 0, 16, 16, 180, 90);
            path.AddArc(Width - 16, 0, 16, 16, 270, 90);
            path.AddArc(Width - 16, Height - 16, 16, 16, 0, 90);
            path.AddArc(0, Height - 16, 16, 16, 90, 90);
            path.CloseFigure();
            Region = new Region(path);

            // Icon & Text
            var lblTitle = new Label
            {
                Text = "MLD Meeting Camera Reminder",
                Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
                ForeColor = Color.FromArgb(245, 158, 11), // Amber Warning
                Location = new Point(16, 12),
                AutoSize = true
            };

            var lblDesc = new Label
            {
                Text = message,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                ForeColor = Color.FromArgb(241, 245, 249),
                Location = new Point(16, 34),
                AutoSize = true
            };

            Controls.Add(lblTitle);
            Controls.Add(lblDesc);

            // Position at bottom-right above taskbar
            Rectangle workArea = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetWorkingArea(this);
            Location = new Point(workArea.Right - Width - 20, workArea.Bottom - Height - 20);

            _fadeTimer = new System.Windows.Forms.Timer { Interval = 100 };
            _fadeTimer.Tick += (s, e) =>
            {
                _ticksRemaining--;
                if (_ticksRemaining <= 10)
                {
                    Opacity = Math.Max(0, Opacity - 0.1);
                }
                if (_ticksRemaining <= 0)
                {
                    _fadeTimer.Stop();
                    Close();
                }
            };
            _fadeTimer.Start();
        }

        public static void ShowPrompt(string message)
        {
            try
            {
                var thread = new System.Threading.Thread(() =>
                {
                    using (var win = new CpatPromptWindow(message))
                    {
                        Application.Run(win);
                    }
                });
                thread.SetApartmentState(System.Threading.ApartmentState.STA);
                thread.IsBackground = true;
                thread.Start();
            }
            catch (Exception ex)
            {
                MldAgent.Logging.AgentLogger.LogError("Error showing camera prompt toast", ex);
            }
        }
    }
}

