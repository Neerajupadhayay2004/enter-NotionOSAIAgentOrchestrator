# CyberGuard Go Backend

A cybersecurity honeypot and attack detection backend written in Go.

## Features

- Honeypot services on multiple ports
- Real-time attack detection and logging
- REST API for incident management
- Attack simulation endpoints
- Statistics and monitoring

## Getting Started

### Prerequisites

- Go 1.21 or higher

### Installation

```bash
cd go-backend
```

### Running the Backend

```bash
chmod +x start.sh
./start.sh
```

Or manually:

```bash
go mod tidy
go build -o cyberguard-backend main.go
./cyberguard-backend
```

## API Endpoints

### Health Check

```
GET /api/v1/health
```

### Incidents

```
GET    /api/v1/incidents          # List all incidents
POST   /api/v1/incidents          # Create a new incident
GET    /api/v1/incidents/:id      # Get incident by ID
PUT    /api/v1/incidents/:id/status  # Update incident status
```

### Honeypot Events

```
GET /api/v1/honeypot-events  # List honeypot events
```

### Simulation

```
POST /api/v1/simulate-attack  # Simulate an attack
```

### Statistics

```
GET /api/v1/stats  # Get backend statistics
```

## Honeypot Services

The backend runs the following honeypot services:

| Service | Port | Description |
|---------|------|-------------|
| SSH | 2222 | Fake SSH server |
| HTTP | 8080 | Fake HTTP server |
| Database | 54321 | Fake database server |
| Admin Panel | 8443 | Fake admin panel |

## Example Usage

### Simulate an Attack

```bash
curl -X POST http://localhost:8081/api/v1/simulate-attack \
  -H "Content-Type: application/json" \
  -d '{"attack_type": "brute_force", "source_ip": "192.168.1.100"}'
```

### Create an Incident

```bash
curl -X POST http://localhost:8081/api/v1/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "source_ip": "10.0.0.5",
    "category": "malware",
    "title": "Malware detected",
    "service": "file",
    "payload": "malicious.exe"
  }'
```

### Get Statistics

```bash
curl http://localhost:8081/api/v1/stats
```
