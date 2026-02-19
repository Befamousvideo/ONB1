package stubs

import (
	"encoding/json"
	"net/http"
	"time"
)

type Conversation struct {
	ID               string       `json:"id"`
	Status           string       `json:"status"`
	ParticipantName  string       `json:"participantName,omitempty"`
	ParticipantEmail string       `json:"participantEmail,omitempty"`
	IntakeBrief      *IntakeBrief `json:"intakeBrief,omitempty"`
	Messages         []Message    `json:"messages"`
	CreatedAt        time.Time    `json:"createdAt"`
	UpdatedAt        time.Time    `json:"updatedAt"`
}

type Message struct {
	ID             string       `json:"id"`
	ConversationID string       `json:"conversationId"`
	Role           string       `json:"role"`
	Content        string       `json:"content"`
	Attachments    []Attachment `json:"attachments,omitempty"`
	CreatedAt      time.Time    `json:"createdAt"`
}

type IntakeBrief struct {
	Summary              string   `json:"summary"`
	Goals                []string `json:"goals"`
	Constraints          []string `json:"constraints"`
	Timeline             string   `json:"timeline,omitempty"`
	Budget               string   `json:"budget,omitempty"`
	RecommendedNextSteps []string `json:"recommendedNextSteps,omitempty"`
}

type UploadLink struct {
	UploadURL string            `json:"uploadUrl"`
	FileURL   string            `json:"fileUrl"`
	Method    string            `json:"method"`
	ExpiresAt time.Time         `json:"expiresAt"`
	Headers   map[string]string `json:"headers"`
}

type Attachment struct {
	FileURL     string `json:"fileUrl"`
	FileName    string `json:"fileName,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	SizeBytes   int64  `json:"sizeBytes,omitempty"`
}

type CreateConversationRequest struct {
	ParticipantName  string `json:"participantName"`
	ParticipantEmail string `json:"participantEmail"`
	InitialMessage   string `json:"initialMessage,omitempty"`
}

type CreateMessageRequest struct {
	Content     string       `json:"content"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

type EndConversationRequest struct {
	Notes string `json:"notes,omitempty"`
}

type EndConversationResponse struct {
	Conversation  Conversation `json:"conversation"`
	HandoffQueued bool         `json:"handoffQueued"`
}

type UploadPresignRequest struct {
	FileName      string `json:"fileName"`
	ContentType   string `json:"contentType"`
	ContentLength int64  `json:"contentLength,omitempty"`
}

type SlackHandoffRequest struct {
	ConversationID     string      `json:"conversationId"`
	Brief              IntakeBrief `json:"brief"`
	DestinationChannel string      `json:"destinationChannel,omitempty"`
}

type SlackHandoffResponse struct {
	Accepted  bool   `json:"accepted"`
	MessageTS string `json:"messageTs,omitempty"`
}

type ErrorResponse struct {
	Error   string   `json:"error"`
	Details []string `json:"details,omitempty"`
}

func RegisterHandlers(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/conversations", CreateConversationHandler)
	mux.HandleFunc("POST /api/conversations/{id}/message", CreateConversationMessageHandler)
	mux.HandleFunc("POST /api/conversations/{id}/end-and-send", EndConversationAndSendHandler)
	mux.HandleFunc("POST /api/uploads/presign", CreateUploadPresignHandler)
	mux.HandleFunc("POST /api/handoff/slack", SendSlackHandoffHandler)
}

func CreateConversationHandler(w http.ResponseWriter, r *http.Request) {
	var req CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid_json"})
		return
	}
	resp := Conversation{
		ID:               "00000000-0000-0000-0000-000000000000",
		Status:           "active",
		ParticipantName:  req.ParticipantName,
		ParticipantEmail: req.ParticipantEmail,
		Messages:         []Message{},
		CreatedAt:        time.Now().UTC(),
		UpdatedAt:        time.Now().UTC(),
	}
	writeJSON(w, http.StatusCreated, resp)
}

func CreateConversationMessageHandler(w http.ResponseWriter, r *http.Request) {
	conversationID := r.PathValue("id")
	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid_json"})
		return
	}
	resp := Message{
		ID:             "00000000-0000-0000-0000-000000000001",
		ConversationID: conversationID,
		Role:           "user",
		Content:        req.Content,
		Attachments:    req.Attachments,
		CreatedAt:      time.Now().UTC(),
	}
	writeJSON(w, http.StatusCreated, resp)
}

func EndConversationAndSendHandler(w http.ResponseWriter, r *http.Request) {
	conversationID := r.PathValue("id")
	_ = conversationID
	if r.Body != nil {
		var req EndConversationRequest
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	resp := EndConversationResponse{
		Conversation: Conversation{
			ID:        conversationID,
			Status:    "ended",
			Messages:  []Message{},
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		},
		HandoffQueued: true,
	}
	writeJSON(w, http.StatusOK, resp)
}

func CreateUploadPresignHandler(w http.ResponseWriter, r *http.Request) {
	var req UploadPresignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid_json"})
		return
	}
	_ = req
	resp := UploadLink{
		UploadURL: "https://uploads.example.com/presigned-put",
		FileURL:   "https://cdn.example.com/uploads/file",
		Method:    "PUT",
		ExpiresAt: time.Now().UTC().Add(15 * time.Minute),
		Headers: map[string]string{
			"content-type": "application/octet-stream",
		},
	}
	writeJSON(w, http.StatusCreated, resp)
}

func SendSlackHandoffHandler(w http.ResponseWriter, r *http.Request) {
	var req SlackHandoffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid_json"})
		return
	}
	_ = req
	writeJSON(w, http.StatusAccepted, SlackHandoffResponse{Accepted: true})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
