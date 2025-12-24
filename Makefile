.PHONY: fmt lint build dev watch watch-dev proto

fmt:
	gofumpt -w ./
	cd web && bun run format

lint:
	golangci-lint run --fix ./... --issues-exit-code=0
	cd web && bun run lint:fix

build:
	cd web && bun install && bun run build
	go build ./cmd/server

dev:
	cd web && bun install && bun run build
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	go run ./cmd/server

watch:
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	DISABLE_STATIC=true air

watch-web:
	cd web && bun install && bun run dev

proto:
	@mkdir -p web/src/gen
	@PATH=$$(pwd)/web/node_modules/.bin:$$PATH \
		protoc -I=proto \
			--go_out=internal/gen/pb --go_opt=paths=source_relative \
			--ts_proto_out=web/src/gen \
		--ts_proto_opt=esModuleInterop=true,forceLong=number,useOptionals=none,snakeToCamel=false,outputServices=none,onlyTypes=true \
			proto/paired_ratings.proto
