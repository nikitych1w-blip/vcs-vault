BINARY   := sync
CLI_DIR  := vault-cli
CONFIG   ?= sources.yaml
GOFLAGS  := -buildvcs=false

.PHONY: build clone pull status help

build:
	cd $(CLI_DIR) && go build $(GOFLAGS) -o ../$(BINARY) .

clone: build
	./$(BINARY) -c $(CONFIG) clone $(SOURCES)

pull: build
	./$(BINARY) -c $(CONFIG) pull $(SOURCES)

status: build
	./$(BINARY) -c $(CONFIG) status

help: build
	./$(BINARY) --help
