package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/pkg/browser"
)

var server *http.Server

func main() {
	// Determine the folder to serve
	exePath, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	exeDir := filepath.Dir(exePath)
	folder := filepath.Join(exeDir, "public")

	// Verify that the folder exists
	if _, err := os.Stat(folder); os.IsNotExist(err) {
		log.Fatalf("Folder %s does not exist", folder)
	}

	port := 8080
	addr := fmt.Sprintf(":%d", port)

	// Create a file server handler
	fs := http.FileServer(http.Dir(folder))
	http.Handle("/", fs)

	// Add a shutdown endpoint
	http.HandleFunc("/shutdown", func(w http.ResponseWriter, r *http.Request) {
		go func() {
			log.Println("Shutting down server...")
			time.Sleep(1 * time.Second) // Give time for response to be sent
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := server.Shutdown(ctx); err != nil {
				log.Fatalf("Server shutdown failed: %v", err)
			}
			log.Println("Server stopped successfully")
		}()
		w.Write([]byte("Server is shutting down..."))
	})

	// Create an HTTP server instance
	server = &http.Server{Addr: addr}

	// Open the default web browser to the server's URL
	url := fmt.Sprintf("http://localhost:%d", port)
	go func() {
		_ = browser.OpenURL(url)
	}()

	log.Printf("Serving %s on HTTP port: %d\n", folder, port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
