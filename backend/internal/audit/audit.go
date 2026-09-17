// Package audit writes rows to audit_logs. docs/ARCHITECTURE.md section 5.2
// requires every write (POST/PATCH/DELETE) on students, attendance,
// journals and users to record one row here.
package audit

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
)

// Log inserts one audit_logs row. tenantID and userID may be empty strings
// (mapped to SQL NULL) for system-level actors. It never returns an error to
// the caller — an audit-log failure must not fail the business request, it
// is only logged server-side.
func Log(ctx context.Context, conn *sql.DB, tenantID, userID, action, entity, entityID string, meta map[string]any) {
	var metaJSON []byte
	if meta == nil {
		metaJSON = []byte(`{}`)
	} else {
		b, err := json.Marshal(meta)
		if err != nil {
			log.Printf("audit: marshal meta failed: %v", err)
			metaJSON = []byte(`{}`)
		} else {
			metaJSON = b
		}
	}

	_, err := conn.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, meta)
		VALUES (NULLIF($1, '')::uuid, NULLIF($2, '')::uuid, $3, $4, NULLIF($5, '')::uuid, $6)
	`, tenantID, userID, action, entity, entityID, metaJSON)
	if err != nil {
		log.Printf("audit: insert failed action=%s entity=%s: %v", action, entity, err)
	}
}
