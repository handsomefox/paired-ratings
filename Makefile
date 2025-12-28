.PHONY: fmt lint build dev watch watch-frontend watch-backend watch-web proto

fmt:
	gofumpt -w ./
	cd frontend && bun run format

lint:
	golangci-lint run --fix ./... --issues-exit-code=0
	cd frontend && bun run lint:fix

build:
	cd frontend && bun install && bun run build
	@mkdir -p bin
	go build -o ./bin/server ./backend

dev:
	cd frontend && bun install && bun run build
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	go run ./backend

watch-backend:
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	DISABLE_STATIC=true air -c backend/.air.toml

watch-frontend:
	cd frontend && bun install && bun run dev

watch:
	@$(MAKE) watch-backend

watch-web:
	@$(MAKE) watch-frontend

proto:
	@mkdir -p frontend/src/gen
	@PATH=$$(pwd)/frontend/node_modules/.bin:$$PATH \
		protoc -I=proto \
			--go_out=backend/gen/pb --go_opt=paths=source_relative \
			--ts_proto_out=frontend/src/gen \
		--ts_proto_opt=esModuleInterop=true,forceLong=number,useOptionals=none,snakeToCamel=false,outputServices=none,onlyTypes=true \
			proto/paired_ratings.proto
