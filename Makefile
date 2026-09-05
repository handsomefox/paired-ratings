.PHONY: fmt fmt-check lint lint-fix test build dev watch watch-frontend watch-backend watch-web proto

fmt:
	gofumpt -w ./backend
	cd frontend && npm run format

fmt-check:
	@test -z "$$(gofumpt -l ./backend)" || (gofumpt -l ./backend; exit 1)
	cd frontend && npm run format:check

lint:
	golangci-lint run ./backend/...
	cd frontend && npm run lint

lint-fix:
	golangci-lint run --fix ./backend/...
	cd frontend && npm run lint:fix

test:
	go test -race ./backend/...
	cd frontend && npm test

build:
	cd frontend && npm ci && npm run build
	@mkdir -p bin
	go build -o ./bin/server ./backend

dev:
	cd frontend && npm ci && npm run build
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	go run ./backend

watch-backend:
	@DB_PATH=$${DB_PATH:-./data/website-rating.db} \
	DISABLE_STATIC=true air -c backend/.air.toml

watch-frontend:
	cd frontend && npm ci && npm run dev

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
