#  Spilboard Dashboard 💦

A sleek, self-hosted dashboard for your home server. Monitor hardware health in real-time, organize your favorite self-hosted services, and customize your view with dynamic backgrounds.

<img width="1465" height="671" alt="image" src="https://github.com/user-attachments/assets/264c3c6b-ef2a-4805-bb21-1d8e7caf40e1" />
<img width="1471" height="797" alt="image" src="https://github.com/user-attachments/assets/cc5fb59b-84dc-4511-a43e-d7d29497226c" />
<img width="1465" height="643" alt="image" src="https://github.com/user-attachments/assets/95ad7301-388d-4f60-b9ca-67b373ab0ac8" />


---

## ✨ Features

* **Real-time Hardware Monitoring:** Live tracking of CPU Load, RAM usage, Storage (ROM), and CPU Temperature.
* **Application Organizer:** Add, edit, and categorize your favorite services (Plex, Home Assistant, Pi-hole, etc.).
* **Drag-and-Drop:** Easily move apps between categories in Edit Mode.
* **Weather:** Integrated weather widget with city autocomplete and automatic coordinate fetching.
* **Modern UI:** Beautiful design that is fully responsive (Desktop, Tablet, and Mobile).
* **Custom Backgrounds:** Support for animated gradients, external image URLs, or local image uploads.
* **Status Pings:** Automatically checks if your services are online or offline.

---

## 🛠️ Installation

The dashboard is designed to run in a **Docker** container for maximum compatibility and ease of use.

### 1. Prerequisites
* [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your Linux server.

### 2. Create the Configuration
Create a folder for the dashboard and place the following `docker-compose.yml` file inside:

```yaml
version: '3'
services:
  dashboard:
    image: spiley/spilboard-dashboard:latest
    container_name: spilboard-dashboard
    restart: unless-stopped
    # Privileged is needed for CPU/RAM/Temp stats
    privileged: true
    ports:
      - "80:80" #change if needed (ie. 8080:80)
    volumes:
      # settingsdata
      - ./data:/app/data
```
### 3. Launch the Dashboard
Run the following command in your terminal:

```Bash
docker-compose up -d

```
Your dashboard will now be available at http://your-server-ip.

---
# ⚙️ Configuration Guide
### Adding Apps
Click Edit in the top right corner.

Click + App.

Enter the name of your service. If it is a common app, the dashboard will try to fetch the icon automatically. If not, it will fall back to your icon.png. (you can change this in the public folder)

Enter the URL (e.g., 192.168.1.50:32400).

### Setting Weather Location
Click Edit > Widgets.

Start typing your city; a list of suggestions will appear. Select your city to save coordinates.

### Changing Background
Click Edit > Settings.

Choose between a Gradient, a URL to a high-quality image, or Upload your own file.

# 📂 Project Architecture
``` Plaintext

├── data/               # Persistent storage for apps.json
├── public/
│   ├── index.html      # UI Structure
│   ├── style.css       # Glassmorphism & Animations
│   ├── script.js       # Frontend Logic & API Handling
│   └── icon.png        # Default fallback icon
├── server.js           # Node.js Express backend (System stats API)
├── Dockerfile          # Image build instructions
└── package.json        # Dependencies (Express, Systeminformation)
```
# 👨‍💻 Contributing
If you'd like to contribute, please fork the repository and use a feature branch. Pull requests are warmly welcome.

Made by Spiley
