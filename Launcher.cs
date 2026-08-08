using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
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
            // Set security protocol for WebClient (TLS 1.2 is required by most modern APIs)
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
            
            string appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MLD-Agent");
            Directory.CreateDirectory(appData);
            
            string jarPath = Path.Combine(appData, "MLD-Agent.jar");
            ExtractResource("MLD-Agent.jar", jarPath);
            
            string javaExe = GetSystemJava();
            
            if (javaExe == null)
            {
                javaExe = GetPortableJava(appData);
            }
            
            if (javaExe != null)
            {
                // Run the agent
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
                    {
                        resStream.CopyTo(fs);
                    }
                }
            }
            catch {}
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
                    if (version == 1)
                    {
                        if (match.Groups.Count > 2)
                            version = int.Parse(match.Groups[2].Value);
                    }
                    
                    if (version >= 17)
                    {
                        return "javaw.exe";
                    }
                }
            }
            catch {}
            return null;
        }
        
        static string GetPortableJava(string appData)
        {
            string jreDir = Path.Combine(appData, "jre");
            string javaExe = FindJavaExe(jreDir);
            
            if (javaExe != null)
                return javaExe;
                
            MessageBox.Show("Setting up MLD Agent for the first time. It is downloading a background runtime...\n\nThis will take a minute and happens only once.", "MLD Agent Setup", MessageBoxButtons.OK, MessageBoxIcon.Information);
            
            string zipPath = Path.Combine(appData, "jre.zip");
            try
            {
                string downloadUrl = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse";
                
                using (WebClient client = new WebClient())
                {
                    client.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
                    client.DownloadFile(downloadUrl, zipPath);
                    
                    if (Directory.Exists(jreDir))
                        Directory.Delete(jreDir, true);
                        
                    ZipFile.ExtractToDirectory(zipPath, jreDir);
                    File.Delete(zipPath);
                    
                    return FindJavaExe(jreDir);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("Error downloading runtime: " + ex.Message, "MLD Agent Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                if (File.Exists(zipPath)) File.Delete(zipPath);
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
