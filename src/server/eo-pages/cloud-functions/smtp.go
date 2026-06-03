package handler

import (
	"context"
	"crypto/subtle"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultSMTPTimeout = 20 * time.Second
	maxSMTPBodyBytes   = 1 << 20
)

type smtpBridgeRequest struct {
	Action         string `json:"action"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Secure         bool   `json:"secure"`
	User           string `json:"user"`
	Pass           string `json:"pass"`
	From           string `json:"from"`
	To             string `json:"to"`
	Subject        string `json:"subject"`
	HTML           string `json:"html"`
	TimeoutSeconds int    `json:"timeoutSeconds"`
}

type smtpBridgeResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message,omitempty"`
}

func Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		respondJSON(w, http.StatusMethodNotAllowed, smtpBridgeResponse{OK: false, Message: "method not allowed"})
		return
	}
	if err := authorizeSMTPBridge(r); err != nil {
		status := http.StatusUnauthorized
		if errors.Is(err, errBridgeTokenNotConfigured) {
			status = http.StatusInternalServerError
		}
		respondJSON(w, status, smtpBridgeResponse{OK: false, Message: err.Error()})
		return
	}

	defer r.Body.Close()
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxSMTPBodyBytes))
	if err != nil {
		respondJSON(w, http.StatusBadRequest, smtpBridgeResponse{OK: false, Message: "request body is too large"})
		return
	}

	var req smtpBridgeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		respondJSON(w, http.StatusBadRequest, smtpBridgeResponse{OK: false, Message: "invalid json body"})
		return
	}
	if err := req.normalize(); err != nil {
		respondJSON(w, http.StatusBadRequest, smtpBridgeResponse{OK: false, Message: err.Error()})
		return
	}

	switch req.Action {
	case "verify":
		err = verifySMTP(req)
	case "send":
		err = sendSMTP(req)
	default:
		err = fmt.Errorf("unsupported action: %s", req.Action)
	}
	if err != nil {
		respondJSON(w, http.StatusBadGateway, smtpBridgeResponse{OK: false, Message: err.Error()})
		return
	}
	respondJSON(w, http.StatusOK, smtpBridgeResponse{OK: true, Message: "ok"})
}

func (req *smtpBridgeRequest) normalize() error {
	req.Action = strings.ToLower(strings.TrimSpace(req.Action))
	req.Host = strings.TrimSpace(req.Host)
	req.User = strings.TrimSpace(req.User)
	req.From = strings.TrimSpace(req.From)
	req.To = strings.TrimSpace(req.To)

	if req.Action == "" {
		req.Action = "verify"
	}
	if req.Host == "" {
		return errors.New("SMTP host is required")
	}
	if req.Port == 0 {
		if req.Secure {
			req.Port = 465
		} else {
			req.Port = 587
		}
	}
	if req.Port < 1 || req.Port > 65535 {
		return errors.New("SMTP port is invalid")
	}
	if req.Action == "send" {
		if req.From == "" {
			return errors.New("mail from is required")
		}
		if req.To == "" {
			return errors.New("mail to is required")
		}
	}
	return nil
}

func (req smtpBridgeRequest) timeout() time.Duration {
	if req.TimeoutSeconds <= 0 || req.TimeoutSeconds > 60 {
		return defaultSMTPTimeout
	}
	return time.Duration(req.TimeoutSeconds) * time.Second
}

func verifySMTP(req smtpBridgeRequest) error {
	client, err := openSMTPClient(req)
	if err != nil {
		return err
	}
	defer client.Close()

	if err := client.Noop(); err != nil {
		return fmt.Errorf("SMTP NOOP failed: %w", err)
	}
	return client.Quit()
}

func sendSMTP(req smtpBridgeRequest) error {
	client, err := openSMTPClient(req)
	if err != nil {
		return err
	}
	defer client.Close()

	fromAddress, err := parseEnvelopeAddress(req.From)
	if err != nil {
		return err
	}
	toAddresses, err := parseEnvelopeAddressList(req.To)
	if err != nil {
		return err
	}
	message, err := buildMessage(req.From, req.To, req.Subject, req.HTML)
	if err != nil {
		return err
	}

	if err := client.Mail(fromAddress); err != nil {
		return fmt.Errorf("SMTP MAIL FROM failed: %w", err)
	}
	for _, toAddress := range toAddresses {
		if err := client.Rcpt(toAddress); err != nil {
			return fmt.Errorf("SMTP RCPT TO failed: %w", err)
		}
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA failed: %w", err)
	}
	if _, err := writer.Write(message); err != nil {
		_ = writer.Close()
		return fmt.Errorf("SMTP write failed: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("SMTP message close failed: %w", err)
	}
	return client.Quit()
}

func openSMTPClient(req smtpBridgeRequest) (*smtp.Client, error) {
	timeout := req.timeout()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	addr := net.JoinHostPort(req.Host, strconv.Itoa(req.Port))
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
		ServerName: req.Host,
	}
	dialer := &net.Dialer{Timeout: timeout}

	var conn net.Conn
	var err error
	if req.Secure {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return nil, fmt.Errorf("connect %s failed: %w", addr, err)
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))

	client, err := smtp.NewClient(conn, req.Host)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("SMTP greeting failed: %w", err)
	}

	if !req.Secure {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(tlsConfig); err != nil {
				_ = client.Close()
				return nil, fmt.Errorf("SMTP STARTTLS failed: %w", err)
			}
		}
	}

	if req.User != "" || req.Pass != "" {
		if err := authenticateSMTP(client, req); err != nil {
			_ = client.Close()
			return nil, err
		}
	}
	return client, nil
}

func authenticateSMTP(client *smtp.Client, req smtpBridgeRequest) error {
	if ok, mechanisms := client.Extension("AUTH"); ok {
		supported := strings.Fields(strings.ToUpper(mechanisms))
		for _, mechanism := range supported {
			switch mechanism {
			case "PLAIN":
				auth := smtp.PlainAuth("", req.User, req.Pass, req.Host)
				if err := client.Auth(auth); err != nil {
					return fmt.Errorf("SMTP auth failed: %w", err)
				}
				return nil
			case "LOGIN":
				if err := client.Auth(loginAuth{username: req.User, password: req.Pass}); err != nil {
					return fmt.Errorf("SMTP auth failed: %w", err)
				}
				return nil
			}
		}
		return fmt.Errorf("SMTP auth failed: unsupported auth mechanisms: %s", mechanisms)
	}
	return errors.New("SMTP auth failed: server does not support AUTH")
}

type loginAuth struct {
	username string
	password string
}

func (auth loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	if !server.TLS && !isLocalSMTPServer(server.Name) {
		return "", nil, errors.New("unencrypted connection")
	}
	return "LOGIN", nil, nil
}

func (auth loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}
	challenge := strings.ToLower(strings.TrimSpace(string(fromServer)))
	if strings.Contains(challenge, "user") {
		return []byte(auth.username), nil
	}
	if strings.Contains(challenge, "pass") {
		return []byte(auth.password), nil
	}
	return nil, fmt.Errorf("unknown SMTP LOGIN challenge: %s", string(fromServer))
}

func isLocalSMTPServer(name string) bool {
	host := strings.Trim(name, "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func parseEnvelopeAddress(value string) (string, error) {
	address, err := mail.ParseAddress(value)
	if err != nil {
		return "", fmt.Errorf("invalid mail address %q: %w", value, err)
	}
	return address.Address, nil
}

func parseEnvelopeAddressList(value string) ([]string, error) {
	addresses, err := mail.ParseAddressList(value)
	if err != nil {
		return nil, fmt.Errorf("invalid recipient address %q: %w", value, err)
	}
	result := make([]string, 0, len(addresses))
	for _, address := range addresses {
		result = append(result, address.Address)
	}
	return result, nil
}

func buildMessage(from string, to string, subject string, html string) ([]byte, error) {
	fromHeader, err := formatAddressHeader(from)
	if err != nil {
		return nil, err
	}
	toHeader, err := formatAddressListHeader(to)
	if err != nil {
		return nil, err
	}

	var builder strings.Builder
	writeHeader(&builder, "From", fromHeader)
	writeHeader(&builder, "To", toHeader)
	writeHeader(&builder, "Subject", mime.QEncoding.Encode("UTF-8", cleanHeader(subject)))
	writeHeader(&builder, "MIME-Version", "1.0")
	writeHeader(&builder, "Content-Type", "text/html; charset=UTF-8")
	writeHeader(&builder, "Content-Transfer-Encoding", "8bit")
	builder.WriteString("\r\n")
	builder.WriteString(normalizeCRLF(html))
	return []byte(builder.String()), nil
}

func formatAddressHeader(value string) (string, error) {
	address, err := mail.ParseAddress(value)
	if err != nil {
		return "", fmt.Errorf("invalid mail address %q: %w", value, err)
	}
	return address.String(), nil
}

func formatAddressListHeader(value string) (string, error) {
	addresses, err := mail.ParseAddressList(value)
	if err != nil {
		return "", fmt.Errorf("invalid recipient address %q: %w", value, err)
	}
	values := make([]string, 0, len(addresses))
	for _, address := range addresses {
		values = append(values, address.String())
	}
	return strings.Join(values, ", "), nil
}

func writeHeader(builder *strings.Builder, key string, value string) {
	builder.WriteString(key)
	builder.WriteString(": ")
	builder.WriteString(cleanHeader(value))
	builder.WriteString("\r\n")
}

func cleanHeader(value string) string {
	value = strings.ReplaceAll(value, "\r", " ")
	value = strings.ReplaceAll(value, "\n", " ")
	return strings.TrimSpace(value)
}

func normalizeCRLF(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	return strings.ReplaceAll(value, "\n", "\r\n")
}

func respondJSON(w http.ResponseWriter, status int, payload smtpBridgeResponse) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func authorizeSMTPBridge(r *http.Request) error {
	expected := os.Getenv("TWIKOO_SMTP_BRIDGE_TOKEN")
	if expected == "" {
		return errBridgeTokenNotConfigured
	}
	auth := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return errors.New("missing SMTP bridge token")
	}
	actual := strings.TrimSpace(strings.TrimPrefix(auth, prefix))
	if subtle.ConstantTimeCompare([]byte(actual), []byte(expected)) != 1 {
		return errors.New("invalid SMTP bridge token")
	}
	return nil
}

var errBridgeTokenNotConfigured = errors.New("TWIKOO_SMTP_BRIDGE_TOKEN is not configured")
