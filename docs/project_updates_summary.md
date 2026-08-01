# Meeting Leech Detector: Project Progress and New Features

This document explains the major changes and new features added to the **Meeting Leech Detector (MLD)** since the first version of the project (Minor Project 1). 

---

## 1. Why Did We Make Changes?
In the first version of the project, the system relied on tracking employees using their **IP Addresses** (a numerical label assigned to a device connected to a computer network). 
While this worked for basic testing, it had major real-world problems:
* **Working from Home:** If an employee's home internet restarted, their IP address changed, and the system lost track of them.
* **Shared Networks:** If multiple employees worked from the same office or coffee shop, they all shared the same public IP address, causing confusion.
* **VPNs:** Many corporate employees use VPNs (Virtual Private Networks) which hide their real IP addresses entirely.

To solve this, we completely removed IP-address tracking and built a much more flexible and secure system.

---

## 2. New Features Added

### A. The "Session Code" System (Replaces IP Addresses)
Instead of relying on network addresses, we built a **Session Code** system (similar to joining a Kahoot game or a Zoom meeting via a link).
* **How it works:** The Manager clicks a button to start a meeting and the system generates a unique 6-character code (e.g., `MLD123`). The manager shares this code with the employees.
* **Why it's better:** Employees just enter the code into their dashboard to join the monitoring session. They can be anywhere in the world, on any network, and the system will perfectly track them.

### B. Webcam Activity Checking
We wanted to ensure employees actually have their cameras turned on during important meetings, without invading their privacy by recording video.
* **How it works:** The system now securely checks the computer's internal settings (the Windows Registry) to see if the webcam hardware is currently broadcasting. It doesn't look at the video; it just asks the computer, *"Is the camera on?"*

### C. Upgraded Database Engine
* **The Change:** We upgraded the underlying database from a simple, single-file system (SQLite) to a robust, professional-grade database engine (**PostgreSQL**).
* **Why it matters:** This allows the backend to handle hundreds of employees sending data at the exact same time without slowing down or crashing. 

### D. Modern "Glassmorphism" Design
* We completely redesigned the visual look of the application for both Employees and Managers. It now features a premium, modern design with semi-transparent elements (glassmorphism), smooth animations, and real-time updating numbers that make the software feel incredibly polished and professional.
