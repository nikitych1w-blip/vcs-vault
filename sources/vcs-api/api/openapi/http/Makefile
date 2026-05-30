ROOT := $(abspath ../../../)

.PHONY: all lint bundle build clean

all: build

lint:
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v2" lint
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v3" lint

bundle:
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v2" bundle
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v3" bundle

build: lint bundle

clean:
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v2" clean
	@$(MAKE) --no-print-directory -C "$(ROOT)/api/openapi/http/v3" clean

