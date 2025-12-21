.PHONY: dev lint fmt

fmt:
	gofumpt -w ./

lint:
	golangci-lint run ./...

dev:
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	go run ./cmd/server
