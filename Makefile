# Go tools run at the versions pinned in tools/go.mod and tools/buf/go.mod.
GO_TOOL := go tool -modfile=tools/go.mod
BUF := go tool -modfile=tools/buf/go.mod buf
DEV_DB := ./data/paired-ratings.db

.PHONY: fmt fmt-check lint lint-fix test vuln generate proto sqlc build dev watch-backend watch-frontend

fmt:
	$(GO_TOOL) gofumpt -w ./backend
	cd frontend && pnpm run format

fmt-check:
	@test -z "$$($(GO_TOOL) gofumpt -l ./backend)" || ($(GO_TOOL) gofumpt -d ./backend; exit 1)
	cd frontend && pnpm run format:check

lint:
	$(GO_TOOL) golangci-lint run ./backend/...
	cd frontend && pnpm run lint

lint-fix:
	$(GO_TOOL) golangci-lint run --fix ./backend/...
	cd frontend && pnpm run lint:fix

test:
	go test -race ./backend/...
	cd frontend && pnpm test

vuln:
	$(GO_TOOL) govulncheck ./backend/...

# generate rewrites every generated tree. Commit the results with the change
# that caused them.
generate: proto sqlc

proto: frontend/node_modules
	$(BUF) generate

sqlc:
	$(GO_TOOL) sqlc generate

build:
	cd frontend && pnpm install --frozen-lockfile && pnpm run build
	@mkdir -p bin
	go build -o ./bin/server ./backend

dev: frontend/node_modules
	cd frontend && pnpm run build
	@DB_PATH=$${DB_PATH:-$(DEV_DB)} go run ./backend

watch-backend:
	@DB_PATH=$${DB_PATH:-$(DEV_DB)} DISABLE_STATIC=true $(GO_TOOL) air -c backend/.air.toml

watch-frontend: frontend/node_modules
	cd frontend && pnpm run dev

# Reinstall only when the lockfile changes.
frontend/node_modules: frontend/pnpm-lock.yaml
	cd frontend && pnpm install --frozen-lockfile
	@touch $@
