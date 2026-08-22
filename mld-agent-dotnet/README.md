# MLD-Agent (.NET / C# Native Windows Agent)

A high-performance, lightweight native Windows background agent for **Meeting Leech Detector (MLD)**.

## ✨ Features
- **Ultra Lightweight**: Pure native C# executable (~38 KB) consuming < 15MB RAM and 0.0% CPU in idle mode.
- **Native Win32 Telemetry**: High-precision active window detection (`GetForegroundWindow`, `GetWindowText`), user idle tracking (`GetLastInputInfo`), and webcam status monitoring via Windows ConsentStore registry.
- **System Tray Integration**: Background notification tray icon with live status indicator (🟢 Active Session, ⚪ Standby, 🔴 Unlinked) and context menu.
- **One-Click Browser Pairing**: Supports `mld-agent://link?token=XYZ` URI protocol handler automatically registered in `HKCU\Software\Classes\mld-agent` without requiring Administrator privileges.
- **Offline Buffering**: Caches up to 500 telemetry events when offline and flushes automatically when connection is restored.
- **No Prerequisites**: Runs natively on all Windows 10 and Windows 11 machines.

## 🛠️ Project Structure
```
mld-agent-dotnet/
├── MldAgent.csproj                  # Multi-target project (net8.0-windows, net48)
├── app.manifest                     # DPI awareness & execution level
├── Program.cs                       # Application entry point & single-instance mutex
├── README.md                        # Documentation
├── Configuration/
│   └── AgentConfiguration.cs        # Properties file persistence (.mld_agent.properties)
├── Logging/
│   └── AgentLogger.cs               # File and debug logger (%TEMP%\mld-agent.log)
├── Monitoring/
│   └── WindowsActivityMonitor.cs    # Win32 P/Invoke hooks for windows, idle, webcam
├── Packaging/
│   ├── build.bat                    # Automated native compiler script
│   └── publish-win-x64.ps1          # .NET single-file publish script
├── Services/
│   ├── AgentApplication.cs          # Background scheduler & monitoring loops
│   ├── BackendClient.cs             # REST API communication with ApiServer
│   └── WindowsRegistration.cs       # Protocol handler & startup registry
└── Tray/
    └── TrayController.cs            # Windows Forms NotifyIcon & context menu
```

## 🚀 Building MLD-Agent.exe

To build using the native Windows compiler:
```cmd
build-agent.bat
```
Or from within `mld-agent-dotnet/Packaging/`:
```cmd
build.bat
```
Or using the .NET SDK:
```cmd
dotnet publish -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
```
The resulting executable `MLD-Agent.exe` is placed in the project root.
