import Cocoa
import Foundation
import AVFoundation
import Vision

// MARK: - Configuration Manager
class AgentConfiguration {
    var serverUrl: String = "https://mld-server.onrender.com"
    var uuid: String = ""
    var cpatEnabled: Bool = false
    
    private let configPath: URL = {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return home.appendingPathComponent(".mld_agent.properties")
    }()
    
    init() {
        load()
    }
    
    func load() {
        guard let data = try? String(contentsOf: configPath, encoding: .utf8) else { return }
        let lines = data.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let parts = trimmed.split(separator: "=", maxSplits: 1).map(String.init)
            if parts.count == 2 {
                let key = parts[0].trimmingCharacters(in: .whitespaces)
                let val = parts[1].trimmingCharacters(in: .whitespaces)
                if key == "serverUrl" && !val.isEmpty { self.serverUrl = val }
                else if key == "uuid" { self.uuid = val }
                else if key == "cpatEnabled" { self.cpatEnabled = (val.lowercased() == "true") }
            }
        }
    }
    
    func save() {
        var content = "# MLD macOS Agent Configuration\n"
        content += "serverUrl=\(serverUrl)\n"
        content += "uuid=\(uuid)\n"
        content += "cpatEnabled=\(cpatEnabled)\n"
        try? content.write(to: configPath, atomically: true, encoding: .utf8)
    }
    
    func updateToken(_ token: String) {
        self.uuid = token
        save()
    }
}

// MARK: - Native macOS Active Window & Idle Tracker
class MacActivityMonitor {
    static func getActiveWindowTitle() -> String {
        // 1. Get frontmost application via NSWorkspace
        if let frontApp = NSWorkspace.shared.frontmostApplication {
            let appName = frontApp.localizedName ?? "Desktop Application"
            let pid = frontApp.processIdentifier
            
            // 2. Query Window Title via CoreGraphics Window List (Permission-safe)
            let options = CGWindowListOption(arrayLiteral: .excludeDesktopElements, .optionOnScreenOnly)
            if let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] {
                for windowInfo in infoList {
                    if let windowPid = windowInfo[kCGWindowOwnerPID as String] as? Int32, windowPid == pid {
                        if let title = windowInfo[kCGWindowName as String] as? String, !title.trimmingCharacters(in: .whitespaces).isEmpty {
                            return "\(appName) - \(title)"
                        }
                    }
                }
            }
            return appName
        }
        return "macOS Desktop Workspace"
    }
    
    static func getIdleSeconds() -> Int {
        var lastEventTime: Double = 0
        let eventTypes: [CGEventType] = [.mouseMoved, .leftMouseDown, .rightMouseDown, .keyDown]
        for type in eventTypes {
            let elapsed = CGEventSource.secondsSinceLastEventType(.hidSystemState, eventType: type)
            if lastEventTime == 0 || elapsed < lastEventTime {
                lastEventTime = elapsed
            }
        }
        return Int(lastEventTime)
    }
    
    static func isWebcamInUse() -> Bool {
        // macOS AVFoundation camera device inspection
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .externalUnknown],
            mediaType: .video,
            position: .unspecified
        )
        for device in discovery.devices {
            if device.isConnected && device.isInUseByAnotherApplication {
                return true
            }
        }
        return false
    }
}

// MARK: - Apple Vision Native Face & Attention Tracker (CPAT for macOS)
class MacVisionFaceTracker: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private var captureSession: AVCaptureSession?
    private let sequenceHandler = VNSequenceRequestHandler()
    private var isFacePresent: Bool = true
    private let detectionQueue = DispatchQueue(label: "com.mld.vision.queue", qos: .userInitiated)
    
    var onAttentionChanged: ((Bool) -> Void)?
    
    func startMonitoring() {
        guard captureSession == nil else { return }
        let session = AVCaptureSession()
        session.sessionPreset = .low // Low resolution for ultra-low memory & CPU
        
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            return
        }
        session.addInput(input)
        
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.setSampleBufferDelegate(self, queue: detectionQueue)
        if session.canAddOutput(output) {
            session.addOutput(output)
        }
        
        DispatchQueue.global(qos: .background).async {
            session.startRunning()
        }
        self.captureSession = session
    }
    
    func stopMonitoring() {
        captureSession?.stopRunning()
        captureSession = nil
    }
    
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        
        // Native Apple Vision Face Detection Request (Zero 3rd party runtime!)
        let request = VNDetectFaceRectanglesRequest { [weak self] req, error in
            guard let results = req.results as? [VNFaceObservation], error == nil else {
                self?.isFacePresent = false
                return
            }
            let faceDetected = !results.isEmpty
            self?.isFacePresent = faceDetected
            self?.onAttentionChanged?(faceDetected)
        }
        
        try? sequenceHandler.perform([request], on: pixelBuffer)
    }
}

// MARK: - HTTP Network Client
class MacBackendClient {
    static func postJson(url: URL, json: String, token: String, completion: @escaping (Bool, String) -> Void) {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        req.setValue("MLD-Agent/2.0 (macOS; Universal)", forHTTPHeaderField: "User-Agent")
        if !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = json.data(using: .utf8)
        req.timeoutInterval = 8
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let err = error {
                completion(false, err.localizedDescription)
                return
            }
            let resStr = data != nil ? String(data: data!, encoding: .utf8) ?? "" : ""
            completion(true, resStr)
        }.resume()
    }
    
    static func getJson(url: URL, completion: @escaping (Bool, String) -> Void) {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("MLD-Agent/2.0 (macOS; Universal)", forHTTPHeaderField: "User-Agent")
        req.timeoutInterval = 8
        
        URLSession.shared.dataTask(with: req) { data, response, error in
            if let err = error {
                completion(false, err.localizedDescription)
                return
            }
            let resStr = data != nil ? String(data: data!, encoding: .utf8) ?? "" : ""
            completion(true, resStr)
        }.resume()
    }
}

// MARK: - Main macOS Menu Bar Application Controller
class MldMacAppController: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private let config = AgentConfiguration()
    private var isMonitoring = false
    private var currentSessionCode: String?
    private var timer: Timer?
    private var heartbeatTimer: Timer?
    private let faceTracker = MacVisionFaceTracker()
    private var isFaceFacing = true
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        setupStatusBar()
        setupUrlSchemeHandling()
        
        faceTracker.onAttentionChanged = { [weak self] present in
            self?.isFaceFacing = present
        }
        
        // Start loops
        startHeartbeatLoop()
        startTelemetryLoop()
        
        // Show status item notification
        showNotification(title: "MLD Agent Ready", body: config.uuid.isEmpty ? "Please link your account from the web dashboard." : "Connected and standing by.")
    }
    
    private func setupStatusBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "● MLD"
        }
        updateMenu()
    }
    
    private func updateMenu() {
        let menu = NSMenu()
        let statusTitle = isMonitoring ? "Session Active: \(currentSessionCode ?? "")" : (config.uuid.isEmpty ? "Unlinked" : "Paired & Standing by")
        menu.addItem(NSMenuItem(title: "Status: \(statusTitle)", action: nil, keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        
        let tokenTitle = config.uuid.isEmpty ? "No Token Linked" : "Token: \(config.uuid.prefix(8))..."
        menu.addItem(NSMenuItem(title: tokenTitle, action: nil, keyEquivalent: ""))
        
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit MLD Agent", action: #selector(quitApp), keyEquivalent: "q"))
        statusItem.menu = menu
    }
    
    @objc private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
    
    private func setupUrlSchemeHandling() {
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleGetURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
    }
    
    @objc private func handleGetURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
        guard let urlString = event.paramDescriptor(forKeyword: keyDirectObject)?.stringValue,
              let url = URL(string: urlString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }
        
        if let tokenItem = components.queryItems?.first(where: { $0.name == "token" }), let token = tokenItem.value {
            config.updateToken(token)
            updateMenu()
            showNotification(title: "Account Paired", body: "MLD macOS Agent successfully linked with token.")
            sendHeartbeat()
        }
    }
    
    private func startHeartbeatLoop() {
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: true) { [weak self] _ in
            self?.sendHeartbeat()
        }
        sendHeartbeat()
    }
    
    private func sendHeartbeat() {
        guard !config.uuid.isEmpty, let url = URL(string: "\(config.serverUrl)/api/heartbeat") else { return }
        let json = "{\"uuid\": \"\(config.uuid)\"}"
        MacBackendClient.postJson(url: url, json: json, token: config.uuid) { _, _ in }
    }
    
    private func startTelemetryLoop() {
        timer = Timer.scheduledTimer(withTimeInterval: 8.0, repeats: true) { [weak self] _ in
            self?.telemetryTick()
        }
    }
    
    private func telemetryTick() {
        guard !config.uuid.isEmpty else {
            if let button = statusItem.button { button.title = "○ MLD" }
            return
        }
        
        // 1. Check Active Session
        guard let sessionUrl = URL(string: "\(config.serverUrl)/api/active-session?uuid=\(config.uuid)") else { return }
        MacBackendClient.getJson(url: sessionUrl) { [weak self] success, res in
            guard let self = self, success else { return }
            let isActive = res.contains("\"active\":true") || res.contains("\"active\": true")
            
            DispatchQueue.main.async {
                if isActive {
                    var sessionCode = "SESSION"
                    if let codeRange = res.range(of: "\"sessionCode\":") {
                        let sub = res[codeRange.upperBound...]
                        if let firstQuote = sub.firstIndex(of: "\""),
                           let secondQuote = sub[sub.index(after: firstQuote)...].firstIndex(of: "\"") {
                            sessionCode = String(sub[sub.index(after: firstQuote)..<secondQuote])
                        }
                    }
                    
                    if !self.isMonitoring {
                        self.isMonitoring = true
                        self.currentSessionCode = sessionCode
                        self.updateMenu()
                        if let button = self.statusItem.button { button.title = "● MLD [Live]" }
                        self.showNotification(title: "Meeting Active", body: "Joined session: \(sessionCode)")
                        if self.config.cpatEnabled { self.faceTracker.startMonitoring() }
                    }
                    
                    self.sendTelemetry(sessionCode: sessionCode)
                } else {
                    if self.isMonitoring {
                        self.isMonitoring = false
                        self.currentSessionCode = nil
                        self.updateMenu()
                        if let button = self.statusItem.button { button.title = "● MLD" }
                        self.showNotification(title: "Meeting Ended", body: "Agent standing by.")
                        self.faceTracker.stopMonitoring()
                    }
                }
            }
        }
    }
    
    private func sendTelemetry(sessionCode: String) {
        guard let trackUrl = URL(string: "\(config.serverUrl)/api/track") else { return }
        var windowTitle = MacActivityMonitor.getActiveWindowTitle()
        let webcamActive = MacActivityMonitor.isWebcamInUse()
        let idleSec = MacActivityMonitor.getIdleSeconds()
        
        if config.cpatEnabled && !isFaceFacing {
            windowTitle = "[Camera: Looking Away] \(windowTitle)"
        }
        
        let escapedTitle = windowTitle.replacingOccurrences(of: "\\", with: "\\\\")
                                      .replacingOccurrences(of: "\"", with: "\\\"")
        let json = "{\"uuid\": \"\(config.uuid)\", \"sessionCode\": \"\(sessionCode)\", \"window\": \"\(escapedTitle)\", \"webcam\": \(webcamActive), \"idle\": \(idleSec)}"
        MacBackendClient.postJson(url: trackUrl, json: json, token: config.uuid) { _, _ in }
    }
    
    private func showNotification(title: String, body: String) {
        let notification = NSUserNotification()
        notification.title = title
        notification.informativeText = body
        notification.soundName = NSUserNotificationDefaultSoundName
        NSUserNotificationCenter.default.deliver(notification)
    }
}

// MARK: - Application Entry Point
let app = NSApplication.shared
let delegate = MldMacAppController()
app.delegate = delegate
app.run()

