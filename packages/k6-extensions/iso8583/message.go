package iso8583

import (
	"encoding/hex"
	"fmt"
	"strings"
)

type Message struct {
	MTI    string
	Fields map[int]string
}

func NewMessage(mti string) *Message {
	return &Message{MTI: mti, Fields: make(map[int]string)}
}

func (m *Message) SetField(index int, value string) {
	m.Fields[index] = value
}

func (m *Message) Build() ([]byte, error) {
	// Generate bitmap from field indices
	var bitmap [16]byte
	fieldIndex := make([]int, 0, len(m.Fields))
	for idx := range m.Fields {
		if idx >= 2 && idx <= 128 {
			fieldIndex = append(fieldIndex, idx)
			bytePos := (idx - 2) / 8
			bitPos := uint((idx - 2) % 8)
			bitmap[bytePos] |= 1 << (7 - bitPos)
		}
	}

	// Build body: fields in ascending order
	var bodyParts []string
	fieldIndex = sortAsc(fieldIndex)
	for _, idx := range fieldIndex {
		bodyParts = append(bodyParts, m.Fields[idx])
	}
	body := strings.Join(bodyParts, "")

	// Convert to hex
	mtiHex := hex.EncodeToString([]byte(m.MTI))
	bitmapHex := hex.EncodeToString(bitmap[:])
	bodyHex := hex.EncodeToString([]byte(body))

	payload := mtiHex + bitmapHex + bodyHex
	return hex.DecodeString(payload)
}

type Response struct {
	Status int
	Data   map[int]string
	Timing int64
	Error  string
}

func parseResponse(raw []byte) (*Response, error) {
	resp := &Response{Status: 200, Data: make(map[int]string)}
	if len(raw) < 4 {
		return resp, fmt.Errorf("response too short: %d bytes", len(raw))
	}
	mti := string(raw[:4])
	resp.Data[0] = mti
	return resp, nil
}

func sortAsc(s []int) []int {
	for i := 0; i < len(s); i++ {
		for j := i + 1; j < len(s); j++ {
			if s[i] > s[j] {
				s[i], s[j] = s[j], s[i]
			}
		}
	}
	return s
}
