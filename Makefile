.PHONY: build fmt lint dev web-dev web-build proto

build: web-build
	go build ./cmd/server

fmt:
	gofumpt -w ./

lint:
	golangci-lint run ./...

dev: web-build
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	go run ./cmd/server

web-dev:
	cd web && bun install && bun run dev

web-build:
	cd web && bun install && bun run build

proto:
	@mkdir -p web/src/gen
	@PATH=$$(pwd)/web/node_modules/.bin:$$PATH \
		protoc -I=proto \
			--go_out=internal/gen/pb --go_opt=paths=source_relative \
			--ts_proto_out=web/src/gen \
		--ts_proto_opt=esModuleInterop=true,forceLong=number,useOptionals=none,snakeToCamel=false,outputServices=none,onlyTypes=true \
			proto/paired_ratings.proto
