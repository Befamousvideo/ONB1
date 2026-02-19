package main

import (
	"log"
	"net/http"

	"onb1/backend/stubs"
)

func main() {
	mux := http.NewServeMux()
	stubs.RegisterHandlers(mux)
	log.Println("stub server listening on :3000")
	if err := http.ListenAndServe(":3000", mux); err != nil {
		log.Fatal(err)
	}
}
