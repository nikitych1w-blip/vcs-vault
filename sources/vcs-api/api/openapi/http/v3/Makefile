GITEA_ROOT := $(abspath ../../../../)

INDEX := api/openapi/http/v3/index.yaml
BUNDLE := api/openapi/http/v3/openapi_http_v3_bundle.yaml

REDOCLY := npx redocly

.PHONY: all lint bundle build clean

all: build

lint:
	@cd "$(GITEA_ROOT)" && $(REDOCLY) lint "./$(INDEX)"

bundle:
	@cd "$(GITEA_ROOT)" && $(REDOCLY) bundle "./$(INDEX)" -o "./$(BUNDLE)"

build: lint bundle

clean:
	@rm -f "$(GITEA_ROOT)/$(BUNDLE)"

