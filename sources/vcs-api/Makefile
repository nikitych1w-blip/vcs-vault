SC_API_COMPAT_BIN ?= sc-api-compat

SC_API_COMPAT_RUN := $(SC_API_COMPAT_BIN)

SPEC_PATH ?=
BASE ?= origin/master
HEAD ?= worktree
FAIL_LEVEL ?= ERR

.PHONY: help build lint bundle postman \
        check-api-compat check-api-compat-all check-api-compat-v2 check-api-compat-v3 check-api-compat-ui \
        all

help:
	@echo ""
	@echo "  Сборка"
	@echo "    make build                    lint + bundle всех спек (v2, v3, ui)"
	@echo "    make lint                     только lint"
	@echo "    make bundle                   только bundle"
	@echo "    make postman                  build + генерация Postman-коллекций"
	@echo ""
	@echo "  Проверка обратной совместимости"
	@echo "    make check-api-compat-all     проверить v2 + v3 + ui"
	@echo "    make check-api-compat-v2      проверить только v2"
	@echo "    make check-api-compat-v3      проверить только v3"
	@echo "    make check-api-compat-ui      проверить только ui"
	@echo ""
	@echo "  Всё вместе"
	@echo "    make all                      build + compat + postman"
	@echo ""
	@echo "  Параметры"
	@echo "    BASE=origin/master            git ref для сравнения (default: origin/master)"
	@echo "    HEAD=worktree                 что сравнивать (default: worktree)"
	@echo "    FAIL_LEVEL=ERR                уровень фейла: ERR, WARN, INFO (default: ERR)"
	@echo "    SC_API_COMPAT_BIN=path        путь к бинарнику sc-api-compat"
	@echo ""


lint:
	@npm run api:http:lint
	@npm run api:ui:lint

bundle:
	@npm run api:http:bundle
	@npm run api:ui:bundle

build: lint bundle

postman: build
	@npm run postman:generate


check-api-compat:
	@$(SC_API_COMPAT_RUN) check --spec "$(SPEC_PATH)" --base "$(BASE)" --head "$(HEAD)" --fail-level "$(FAIL_LEVEL)"

check-api-compat-all: check-api-compat-v2 check-api-compat-v3 check-api-compat-ui

check-api-compat-v2:
	@$(MAKE) check-api-compat SPEC_PATH=api/openapi/http/v2/openapi_http_v2_bundle.yaml

check-api-compat-v3:
	@$(MAKE) check-api-compat SPEC_PATH=api/openapi/http/v3/openapi_http_v3_bundle.yaml

check-api-compat-ui:
	@$(MAKE) check-api-compat SPEC_PATH=api/openapi/ui/openapi_ui_bundle.yaml


all: build check-api-compat-all postman
