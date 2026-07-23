package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Incident represents a security incident
type Incident struct {
	ID             string    `json:"id"`
	IncidentNumber string    `json:"incident_number"`
	Title          string    `json:"title"`
	Category       string    `json:"category"`
	SourceIP       string    `json:"source_ip"`
	FileHash       string    `json:"file_hash,omitempty"`
	Severity       string    `json:"severity"`
	RiskScore      int       `json:"risk_score"`
	Status         string    `json:"status"`
	Decision       string    `json:"decision,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// HoneypotEvent represents a honeypot detection event
type HoneypotEvent struct {
	ID        string    `json:"id"`
	SourceIP  string    `json:"source_ip"`
	Service   string    `json:"service"`
	Port      int       `json:"port"`
	Payload   string    `json:"payload,omitempty"`
	Verdict   string    `json:"verdict"`
	CreatedAt time.Time `json:"created_at"`
}

// SecurityBackend is the main application struct
type SecurityBackend struct {
	incidents       map[string]*Incident
	honeypotEvents  map[string]*HoneypotEvent
	mu              sync.RWMutex
	incidentCounter int
	honeypotCounter int
	supabaseURL     string
	supabaseKey     string
}

func NewSecurityBackend() *SecurityBackend {
	return &SecurityBackend{
		incidents:       make(map[string]*Incident),
		honeypotEvents:  make(map[string]*HoneypotEvent),
		incidentCounter: 1000,
		honeypotCounter: 1,
		supabaseURL:     os.Getenv("SUPABASE_URL"),
		supabaseKey:     os.Getenv("SUPABASE_ANON_KEY"),
	}
}

func (sb *SecurityBackend) generateIncidentNumber() string {
	sb.incidentCounter++
	return fmt.Sprintf("INC-%04d", sb.incidentCounter)
}

func (sb *SecurityBackend) generateHoneypotID() string {
	sb.honeypotCounter++
	return fmt.Sprintf("HONE-%04d", sb.honeypotCounter)
}

func (sb *SecurityBackend) calculateRiskScore(category, severity string) int {
	baseScores := map[string]int{
		"port_scan":     30,
		"brute_force":   60,
		"malware":       85,
		"ddos":          90,
		"phishing":      75,
		"c2_beacon":     95,
		"xss":           55,
		"sql_injection": 80,
	}

	severityMultiplier := map[string]float64{
		"low":      0.7,
		"medium":   1.0,
		"high":     1.3,
		"critical": 1.5,
	}

	base, ok := baseScores[category]
	if !ok {
		base = 50
	}

	multiplier, ok := severityMultiplier[severity]
	if !ok {
		multiplier = 1.0
	}

	score := int(float64(base) * multiplier)
	if score > 100 {
		score = 100
	}
	return score
}

func (sb *SecurityBackend) determineSeverity(category string) string {
	highRisk := map[string]bool{
		"malware":   true,
		"ddos":      true,
		"c2_beacon": true,
	}

	mediumRisk := map[string]bool{
		"brute_force":   true,
		"phishing":      true,
		"sql_injection": true,
	}

	if highRisk[category] {
		return "high"
	}
	if mediumRisk[category] {
		return "medium"
	}
	return "low"
}

func (sb *SecurityBackend) createIncident(c *gin.Context) {
	var req struct {
		SourceIP string `json:"source_ip" binding:"required"`
		Category string `json:"category" binding:"required"`
		Title    string `json:"title"`
		Service  string `json:"service"`
		Payload  string `json:"payload"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sb.mu.Lock()
	defer sb.mu.Unlock()

	severity := sb.determineSeverity(req.Category)
	riskScore := sb.calculateRiskScore(req.Category, severity)

	if req.Title == "" {
		req.Title = fmt.Sprintf("%s attack detected from %s", req.Category, req.SourceIP)
	}

	incident := &Incident{
		ID:             sb.generateIncidentNumber(),
		IncidentNumber: sb.generateIncidentNumber(),
		Title:          req.Title,
		Category:       req.Category,
		SourceIP:       req.SourceIP,
		Severity:       severity,
		RiskScore:      riskScore,
		Status:         "detected",
		CreatedAt:      time.Now(),
	}

	sb.incidents[incident.ID] = incident

	honeypotEvent := &HoneypotEvent{
		ID:        sb.generateHoneypotID(),
		SourceIP:  req.SourceIP,
		Service:   req.Service,
		Port:      0,
		Payload:   req.Payload,
		Verdict:   "malicious",
		CreatedAt: time.Now(),
	}

	sb.honeypotEvents[honeypotEvent.ID] = honeypotEvent

	c.JSON(http.StatusCreated, gin.H{
		"incident":       incident,
		"honeypot_event": honeypotEvent,
	})
}

func (sb *SecurityBackend) getIncidents(c *gin.Context) {
	sb.mu.RLock()
	defer sb.mu.RUnlock()

	incidentsList := make([]*Incident, 0, len(sb.incidents))
	for _, inc := range sb.incidents {
		incidentsList = append(incidentsList, inc)
	}

	c.JSON(http.StatusOK, incidentsList)
}

func (sb *SecurityBackend) getIncident(c *gin.Context) {
	id := c.Param("id")

	sb.mu.RLock()
	incident, exists := sb.incidents[id]
	sb.mu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
		return
	}

	c.JSON(http.StatusOK, incident)
}

func (sb *SecurityBackend) updateIncidentStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Status   string `json:"status" binding:"required"`
		Decision string `json:"decision"`
		Actor    string `json:"actor"`
		Notes    string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sb.mu.Lock()
	incident, exists := sb.incidents[id]
	if exists {
		incident.Status = req.Status
		incident.Decision = req.Decision
	}
	sb.mu.Unlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Incident not found"})
		return
	}

	c.JSON(http.StatusOK, incident)
}

func (sb *SecurityBackend) simulateAttack(c *gin.Context) {
	var req struct {
		AttackType string `json:"attack_type" binding:"required"`
		SourceIP   string `json:"source_ip"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.SourceIP == "" {
		req.SourceIP = fmt.Sprintf("%d.%d.%d.%d",
			192+randInt(0, 63),
			168+randInt(0, 63),
			randInt(0, 255),
			randInt(0, 255))
	}

	attackTitles := map[string]string{
		"port_scan":     "Port scan detected",
		"brute_force":   "SSH brute force attempt",
		"malware":       "Malware signature detected",
		"ddos":          "DDoS attack detected",
		"phishing":      "Phishing attempt blocked",
		"c2_beacon":     "C2 beacon activity detected",
		"xss":           "XSS payload detected",
		"sql_injection": "SQL injection attempt",
	}

	services := map[string]string{
		"port_scan":     "network",
		"brute_force":   "ssh",
		"malware":       "file",
		"ddos":          "network",
		"phishing":      "email",
		"c2_beacon":     "network",
		"xss":           "web",
		"sql_injection": "database",
	}

	sb.mu.Lock()
	defer sb.mu.Unlock()

	severity := sb.determineSeverity(req.AttackType)
	riskScore := sb.calculateRiskScore(req.AttackType, severity)

	incidentNumber := sb.generateIncidentNumber()
	incident := &Incident{
		ID:             incidentNumber,
		IncidentNumber: incidentNumber,
		Title:          attackTitles[req.AttackType],
		Category:       req.AttackType,
		SourceIP:       req.SourceIP,
		Severity:       severity,
		RiskScore:      riskScore,
		Status:         "detected",
		CreatedAt:      time.Now(),
	}

	sb.incidents[incident.ID] = incident

	honeypotEvent := &HoneypotEvent{
		ID:        sb.generateHoneypotID(),
		SourceIP:  req.SourceIP,
		Service:   services[req.AttackType],
		Port:      randInt(1000, 65535),
		Payload:   fmt.Sprintf("%s attack payload", req.AttackType),
		Verdict:   "malicious",
		CreatedAt: time.Now(),
	}

	sb.honeypotEvents[honeypotEvent.ID] = honeypotEvent

	c.JSON(http.StatusCreated, gin.H{
		"message":        "Attack simulated successfully",
		"incident":       incident,
		"honeypot_event": honeypotEvent,
	})
}

func (sb *SecurityBackend) getHoneypotEvents(c *gin.Context) {
	sb.mu.RLock()
	defer sb.mu.RUnlock()

	eventsList := make([]*HoneypotEvent, 0, len(sb.honeypotEvents))
	for _, evt := range sb.honeypotEvents {
		eventsList = append(eventsList, evt)
	}

	c.JSON(http.StatusOK, eventsList)
}

func (sb *SecurityBackend) getStats(c *gin.Context) {
	sb.mu.RLock()
	defer sb.mu.RUnlock()

	statusCounts := map[string]int{
		"detected":         0,
		"analyzing":        0,
		"pending_approval": 0,
		"resolved":         0,
		"dismissed":        0,
		"blocked":          0,
	}

	severityCounts := map[string]int{
		"low":      0,
		"medium":   0,
		"high":     0,
		"critical": 0,
	}

	totalRiskScore := 0
	for _, inc := range sb.incidents {
		statusCounts[inc.Status]++
		severityCounts[inc.Severity]++
		totalRiskScore += inc.RiskScore
	}

	avgRiskScore := 0
	if len(sb.incidents) > 0 {
		avgRiskScore = totalRiskScore / len(sb.incidents)
	}

	c.JSON(http.StatusOK, gin.H{
		"total_incidents":       len(sb.incidents),
		"total_honeypot_events": len(sb.honeypotEvents),
		"status_counts":         statusCounts,
		"severity_counts":       severityCounts,
		"avg_risk_score":        avgRiskScore,
	})
}

func (sb *SecurityBackend) startHoneypotListener() {
	services := map[string]int{
		"ssh":         2222,
		"http":        8080,
		"database":    54321,
		"admin_panel": 8443,
	}

	for service, port := range services {
		go func(serviceName string, listenPort int) {
			addr := fmt.Sprintf(":%d", listenPort)
			listener, err := net.Listen("tcp", addr)
			if err != nil {
				log.Printf("Failed to start %s honeypot on port %d: %v", serviceName, listenPort, err)
				return
			}
			defer listener.Close()

			log.Printf("Honeypot %s listening on port %d", serviceName, listenPort)

			for {
				conn, err := listener.Accept()
				if err != nil {
					log.Printf("Accept error: %v", err)
					continue
				}

				go sb.handleHoneypotConnection(conn, serviceName, listenPort)
			}
		}(service, port)
	}
}

func (sb *SecurityBackend) handleHoneypotConnection(conn net.Conn, service string, port int) {
	defer conn.Close()

	remoteAddr := conn.RemoteAddr().String()
	host, _, _ := net.SplitHostPort(remoteAddr)

	log.Printf("Honeypot connection from %s to %s:%d", host, service, port)

	buf := make([]byte, 4096)
	n, _ := conn.Read(buf)
	payload := string(buf[:n])

	sb.mu.Lock()

	severity := "medium"
	category := "port_scan"
	if service == "ssh" {
		category = "brute_force"
		severity = "high"
	} else if service == "admin_panel" {
		category = "c2_beacon"
		severity = "critical"
	}

	riskScore := sb.calculateRiskScore(category, severity)

	incidentNumber := sb.generateIncidentNumber()
	incident := &Incident{
		ID:             incidentNumber,
		IncidentNumber: incidentNumber,
		Title:          fmt.Sprintf("Unauthorized access attempt to %s honeypot", service),
		Category:       category,
		SourceIP:       host,
		Severity:       severity,
		RiskScore:      riskScore,
		Status:         "detected",
		CreatedAt:      time.Now(),
	}

	sb.incidents[incident.ID] = incident

	honeypotEvent := &HoneypotEvent{
		ID:        sb.generateHoneypotID(),
		SourceIP:  host,
		Service:   service,
		Port:      port,
		Payload:   payload,
		Verdict:   "malicious",
		CreatedAt: time.Now(),
	}

	sb.honeypotEvents[honeypotEvent.ID] = honeypotEvent

	sb.mu.Unlock()

	log.Printf("Created incident %s from %s", incidentNumber, host)

	conn.Write([]byte("Connection closed by remote host.\n"))
}

func randInt(min, max int) int {
	return min + int(time.Now().UnixNano()%int64(max-min+1))
}

func loadConfig() map[string]string {
	config := make(map[string]string)

	configFile := "config.json"
	if _, err := os.Stat(configFile); err == nil {
		data, err := os.ReadFile(configFile)
		if err == nil {
			json.Unmarshal(data, &config)
		}
	}

	for _, env := range os.Environ() {
		for i := 0; i < len(env); i++ {
			if env[i] == '=' {
				key := env[:i]
				value := env[i+1:]
				config[key] = value
				break
			}
		}
	}

	return config
}

func main() {
	_ = loadConfig() // Load config but ignore it for now

	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	sb := NewSecurityBackend()

	go sb.startHoneypotListener()

	api := router.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "cyberguard-backend"})
		})

		api.POST("/incidents", sb.createIncident)
		api.GET("/incidents", sb.getIncidents)
		api.GET("/incidents/:id", sb.getIncident)
		api.PUT("/incidents/:id/status", sb.updateIncidentStatus)
		api.POST("/simulate-attack", sb.simulateAttack)

		api.GET("/honeypot-events", sb.getHoneypotEvents)

		api.GET("/stats", sb.getStats)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("CyberGuard Backend starting on port %s", port)
	log.Printf("Honeypot services starting on ports: 2222 (SSH), 8080 (HTTP), 54321 (Database), 8443 (Admin Panel)")

	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
