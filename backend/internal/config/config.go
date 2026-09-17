// Package config reads the process configuration from environment
// variables (optionally loaded from a .env file via godotenv).
package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the backend.
type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	Env                string
	SuperAdminEmail    string
	SuperAdminPassword string
	AllowedOrigin      string
}

// Load reads configuration from the environment. If a .env file exists in
// the working directory it is loaded first (missing file is not an error).
func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:               getEnv("PORT", "8097"),
		DatabaseURL:        getEnv("DATABASE_URL", ""),
		JWTSecret:          getEnv("JWT_SECRET", ""),
		Env:                getEnv("ENV", "development"),
		SuperAdminEmail:    os.Getenv("SUPER_ADMIN_EMAIL"),
		SuperAdminPassword: os.Getenv("SUPER_ADMIN_PASSWORD"),
		AllowedOrigin:      getEnv("ALLOWED_ORIGIN", "*"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
