using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace MLDAgent
{
    class Program
    {
        static void Main(string[] args)
        {
            // Require TLS 1.2 for all WebClient calls
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;

            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MLD-Agent");
            Directory.CreateDirectory(appData);

            string jarPath = Path.Combine(appData, "MLD-Agent.jar");
            ExtractResource("MLD-Agent.jar", jarPath);

            string javaExe = GetSystemJava();

            if (javaExe == null)
                javaExe = GetPortableJava(appData);

            if (javaExe != null)
            {
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = javaExe;
                psi.Arguments = "-jar \"" + jarPath + "\"";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;

                try
                {
                    Process.Start(psi);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Failed to start agent: " + ex.Message, "MLD Agent Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            else
            {
                MessageBox.Show("Failed to find or download Java.", "MLD Agent Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        static void ExtractResource(string resourceName, string outPath)
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                using (Stream resStream = assembly.GetManifestResourceStream(resourceName))
                {
                    if (resStream == null) return;
                    using (FileStream fs = new FileStream(outPath, FileMode.Create))
                        resStream.CopyTo(fs);
                }
            }
            catch { }
        }

        static string GetSystemJava()
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("java", "-version");
                psi.RedirectStandardError = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                Process p = Process.Start(psi);
                string output = p.StandardError.ReadToEnd();
                p.WaitForExit();

                Match match = Regex.Match(output, "\"(\\d+)\\.(\\d+)");
                if (!match.Success)
                    match = Regex.Match(output, "\"(\\d+)");

                if (match.Success)
                {
                    int version = int.Parse(match.Groups[1].Value);
                    if (version == 1 && match.Groups.Count > 2)
                        version = int.Parse(match.Groups[2].Value);

                    if (version >= 17)
                        return "javaw.exe";
                }
            }
            catch { }
            return null;
        }

        static string GetPortableJava(string appData)
        {
            string jreDir = Path.Combine(appData, "jre");
            string javaExe = FindJavaExe(jreDir);

            if (javaExe != null)
                return javaExe;

            MessageBox.Show(
                "Setting up MLD Agent for the first time.\nDownloading a background Java runtime — this happens only once and takes ~1 minute.",
                "MLD Agent Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);

            string zipPath = Path.Combine(appData, "jre.zip");
            try
            {
                // Direct stable download — Adoptium JRE 21 for Windows x64
                string downloadUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse";

                using (WebClient client = new WebClient())
                {
                    client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    client.DownloadFile(downloadUrl, zipPath);
                }

                // Verify the downloaded file is not empty
                FileInfo fi = new FileInfo(zipPath);
                if (fi.Length < 1024 * 1024)
                    throw new Exception("Downloaded file is too small — likely an error page, not a ZIP.");

                // Use Windows built-in tar.exe (available on Windows 10+) to extract
                // This handles ZIP64 large archives that .NET 4 ZipFile cannot
                if (Directory.Exists(jreDir))
                    Directory.Delete(jreDir, true);
                Directory.CreateDirectory(jreDir);

                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = "tar.exe";
                psi.Arguments = "-xf \"" + zipPath + "\" -C \"" + jreDir + "\" --strip-components=1";
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.RedirectStandardError = true;
                Process tarProc = Process.Start(psi);
                string tarErr = tarProc.StandardError.ReadToEnd();
                tarProc.WaitForExit();

                if (tarProc.ExitCode != 0)
                    throw new Exception("Extraction failed: " + tarErr);

                File.Delete(zipPath);

                return FindJavaExe(jreDir);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error downloading runtime: " + ex.Message, "MLD Agent Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                if (File.Exists(zipPath))
                    File.Delete(zipPath);
            }

            return null;
        }

        static string FindJavaExe(string dir)
        {
            if (!Directory.Exists(dir)) return null;
            string[] files = Directory.GetFiles(dir, "javaw.exe", SearchOption.AllDirectories);
            if (files.Length > 0) return files[0];
            return null;
        }
    }
}
