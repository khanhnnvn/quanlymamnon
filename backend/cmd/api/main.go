// Command api is the Go backend for the multi-tenant preschool management
// system. See docs/ARCHITECTURE.md for the full contract.
package main

import (
	"context"
	"database/sql"
	"log"

	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/announcement"
	"mamnon/backend/internal/attendance"
	"mamnon/backend/internal/auth"
	"mamnon/backend/internal/config"
	"mamnon/backend/internal/dashboard"
	"mamnon/backend/internal/db"
	"mamnon/backend/internal/journal"
	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/response"
	"mamnon/backend/internal/school"
	"mamnon/backend/internal/student"
	"mamnon/backend/internal/tenant"
	"mamnon/backend/internal/user"
)

func main() {
	cfg := config.Load()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is not set")
	}

	conn, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer conn.Close()

	if err := db.RunMigrations(conn); err != nil {
		log.Fatalf("migrations failed: %v", err)
	}
	log.Println("migrations up to date")

	if err := bootstrapSuperAdmin(context.Background(), conn, cfg); err != nil {
		log.Printf("bootstrap super admin: %v", err)
	}

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := buildRouter(conn, cfg)

	addr := ":" + cfg.Port
	log.Printf("listening on %s (env=%s)", addr, cfg.Env)
	if err := router.Run(addr); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}

func buildRouter(conn *sql.DB, cfg config.Config) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery(), middleware.RequestLogger(), middleware.CORS(cfg.AllowedOrigin))

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	api := router.Group("/api/v1")

	// ---- system (Super Admin, no slug) ----
	tenantRepo := tenant.NewRepository(conn)
	tenantSvc := tenant.NewService(tenantRepo, cfg.JWTSecret)
	tenantHandler := tenant.NewHandler(tenantSvc)
	tenantHandler.RegisterRoutes(api, cfg.JWTSecret)

	// ---- tenant-scoped routes: /api/v1/:slug/... ----
	tenantGroup := api.Group("/:slug")
	tenantGroup.Use(middleware.TenantResolver(conn))

	authed := tenantGroup.Group("")
	authed.Use(middleware.AuthRequired(cfg.JWTSecret), middleware.RequireTenantMatch())

	userRepo := user.NewRepository(conn)
	userSvc := user.NewService(userRepo, cfg.JWTSecret)
	userHandler := user.NewHandler(userSvc, conn)
	userHandler.RegisterRoutes(tenantGroup, authed)

	schoolRepo := school.NewRepository(conn)
	schoolSvc := school.NewService(schoolRepo, conn)
	school.NewHandler(schoolSvc).RegisterRoutes(authed)

	studentRepo := student.NewRepository(conn)
	studentSvc := student.NewService(studentRepo, conn)
	student.NewHandler(studentSvc, conn).RegisterRoutes(authed)

	attendanceRepo := attendance.NewRepository(conn)
	attendanceSvc := attendance.NewService(attendanceRepo, conn)
	attendance.NewHandler(attendanceSvc, conn).RegisterRoutes(authed)

	journalRepo := journal.NewRepository(conn)
	journalSvc := journal.NewService(journalRepo, conn)
	journal.NewHandler(journalSvc, conn).RegisterRoutes(authed)

	announcementRepo := announcement.NewRepository(conn)
	announcementSvc := announcement.NewService(announcementRepo, conn)
	announcement.NewHandler(announcementSvc).RegisterRoutes(authed)

	dashboardRepo := dashboard.NewRepository(conn)
	dashboardSvc := dashboard.NewService(dashboardRepo)
	dashboard.NewHandler(dashboardSvc).RegisterRoutes(authed)

	router.NoRoute(func(c *gin.Context) {
		response.NotFound(c, "Không tìm thấy đường dẫn")
	})

	return router
}

// bootstrapSuperAdmin creates the first Super Admin from
// SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD if set and no Super Admin exists
// yet. It runs once at startup and is not exposed as an API.
func bootstrapSuperAdmin(ctx context.Context, conn *sql.DB, cfg config.Config) error {
	if cfg.SuperAdminEmail == "" || cfg.SuperAdminPassword == "" {
		return nil
	}

	var exists bool
	err := conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM users u
			JOIN user_roles ur ON ur.user_id = u.id
			JOIN roles r ON r.id = ur.role_id
			WHERE u.tenant_id IS NULL AND r.code = 'SUPER_ADMIN'
		)
	`).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		log.Println("bootstrap: a super admin already exists, skipping")
		return nil
	}

	hash, err := auth.HashPassword(cfg.SuperAdminPassword)
	if err != nil {
		return err
	}

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	var userID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (tenant_id, email, password_hash, full_name, status)
		VALUES (NULL, $1, $2, 'Super Admin', 'active')
		RETURNING id
	`, cfg.SuperAdminEmail, hash).Scan(&userID)
	if err != nil {
		return err
	}

	var roleID string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM roles WHERE code = 'SUPER_ADMIN'`).Scan(&roleID); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, NULL)
	`, userID, roleID); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("bootstrap: created super admin %s", cfg.SuperAdminEmail)
	return nil
}
