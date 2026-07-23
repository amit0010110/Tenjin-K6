package iso8583

import (
	"encoding/binary"
	"fmt"
	"net"
	"strconv"
	"time"
)

type ClientConfig struct {
	Host        string
	Port        int
	TimeoutSec  int
	HeaderBytes int
}

type Client struct {
	config ClientConfig
}

func NewClient(config map[string]interface{}) *Client {
	c := &Client{
		config: ClientConfig{
			Host:        "127.0.0.1",
			Port:        5000,
			TimeoutSec:  30,
			HeaderBytes: 2,
		},
	}
	if host, ok := config["host"].(string); ok {
		c.config.Host = host
	}
	if port, ok := config["port"].(int); ok {
		c.config.Port = port
	}
	if timeout, ok := config["timeout"].(int); ok {
		c.config.TimeoutSec = timeout
	}
	if hb, ok := config["headerBytes"].(int); ok {
		c.config.HeaderBytes = hb
	}
	return c
}

func (c *Client) Send(message *Message) *Response {
	start := time.Now()
	resp := &Response{Status: 200, Data: make(map[int]string)}

	payload, err := message.Build()
	if err != nil {
		resp.Status = 500
		resp.Error = err.Error()
		resp.Timing = time.Since(start).Milliseconds()
		return resp
	}

	addr := net.JoinHostPort(c.config.Host, strconv.Itoa(c.config.Port))
	conn, err := net.DialTimeout("tcp", addr, time.Duration(c.config.TimeoutSec)*time.Second)
	if err != nil {
		resp.Status = 502
		resp.Error = fmt.Sprintf("connection failed: %v", err)
		resp.Timing = time.Since(start).Milliseconds()
		return resp
	}
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(time.Duration(c.config.TimeoutSec) * time.Second))

	// Write length header + payload
	var header []byte
	switch c.config.HeaderBytes {
	case 2:
		header = make([]byte, 2)
		binary.BigEndian.PutUint16(header, uint16(len(payload)))
	case 4:
		header = make([]byte, 4)
		binary.BigEndian.PutUint32(header, uint32(len(payload)))
	}
	toSend := append(header, payload...)
	if _, err := conn.Write(toSend); err != nil {
		resp.Status = 502
		resp.Error = fmt.Sprintf("write failed: %v", err)
		resp.Timing = time.Since(start).Milliseconds()
		return resp
	}

	// Read response
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		resp.Status = 502
		resp.Error = fmt.Sprintf("read failed: %v", err)
		resp.Timing = time.Since(start).Milliseconds()
		return resp
	}

	raw := buf[:n]
	parsed, err := parseResponse(raw)
	if err != nil {
		resp.Error = err.Error()
	}
	resp.Status = parsed.Status
	resp.Data = parsed.Data
	resp.Timing = time.Since(start).Milliseconds()
	return resp
}
