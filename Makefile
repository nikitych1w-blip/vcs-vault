BINARY   := sync
CLI_DIR  := vault-cli
CONFIG   ?= sources.yaml
GOFLAGS  := -buildvcs=false

OPENSPEC := openspec
CHANGE   ?=
ARTIFACT ?= proposal
AUTO_SYNC    ?= 1
AUTO_ARCHIVE ?= 0
FLOW_STATE_DIR ?= .openspec-flow

.PHONY: build clone pull vault-status help \
        openspec-config openspec-validate openspec-new openspec-status \
        openspec-instructions openspec-ff openspec-archive openspec-list \
        openspec-flow openspec-flow-resume \
        sync setup

# ---------------------------------------------------------------------------
# Справка
# ---------------------------------------------------------------------------

help: ## Показать доступные команды
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# vault-cli
# ---------------------------------------------------------------------------

setup: ## Настроить репозиторий после клонирования (git hooks и др.)
	git config core.hooksPath .githooks

build: ## Собрать vault-cli бинарь
	cd $(CLI_DIR) && go build $(GOFLAGS) -o ../$(BINARY) .

clone: build ## Клонировать источники: make clone SOURCES=...
	./$(BINARY) -c $(CONFIG) clone $(SOURCES)

pull: build ## Обновить источники: make pull SOURCES=...
	./$(BINARY) -c $(CONFIG) pull $(SOURCES)

vault-status: build ## Статус источников vault-cli
	./$(BINARY) -c $(CONFIG) status

# ---------------------------------------------------------------------------
# openspec — скиллы и схема
# ---------------------------------------------------------------------------

openspec-config: ## Пересобрать openspec/config.yaml из vault/skills/
	@bash scripts/build-openspec-config.sh

openspec-validate: ## Валидировать схему vcs
	$(OPENSPEC) schema validate vcs

# ---------------------------------------------------------------------------
# openspec — работа с изменениями
# ---------------------------------------------------------------------------

openspec-new: ## Создать изменение: make openspec-new CHANGE=vcs-10012-name
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-new CHANGE=vcs-XXXXX-name"; exit 1; }
	$(OPENSPEC) new change $(CHANGE) --schema vcs

openspec-status: ## Статус артефактов: make openspec-status CHANGE=vcs-10012-name
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-status CHANGE=vcs-XXXXX-name"; exit 1; }
	$(OPENSPEC) status --change $(CHANGE)

openspec-instructions: ## Инструкции: make openspec-instructions CHANGE=... ARTIFACT=proposal
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-instructions CHANGE=vcs-XXXXX-name"; exit 1; }
	$(OPENSPEC) instructions $(ARTIFACT) --change $(CHANGE)

openspec-ff: ## Fast-forward все артефакты: make openspec-ff CHANGE=vcs-10012-name
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-ff CHANGE=vcs-XXXXX-name"; exit 1; }
	$(OPENSPEC) instructions --change $(CHANGE)

openspec-archive: ## Архивировать изменение: make openspec-archive CHANGE=vcs-10012-name
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-archive CHANGE=vcs-XXXXX-name"; exit 1; }
	$(OPENSPEC) archive $(CHANGE)

openspec-list: ## Список активных изменений
	$(OPENSPEC) list

openspec-flow: ## One-command flow: make openspec-flow CHANGE=vcs-10012-name [AUTO_SYNC=1] [AUTO_ARCHIVE=0]
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-flow CHANGE=vcs-XXXXX-name"; exit 1; }
	@bash scripts/openspec-flow.sh \
		--change "$(CHANGE)" \
		--openspec "$(OPENSPEC)" \
		--auto-sync "$(AUTO_SYNC)" \
		--auto-archive "$(AUTO_ARCHIVE)" \
		--state-dir "$(FLOW_STATE_DIR)"

openspec-flow-resume: ## Продолжить flow: make openspec-flow-resume CHANGE=vcs-10012-name
	@[ -n "$(CHANGE)" ] || { echo "Укажи: make openspec-flow-resume CHANGE=vcs-XXXXX-name"; exit 1; }
	@bash scripts/openspec-flow.sh \
		--change "$(CHANGE)" \
		--openspec "$(OPENSPEC)" \
		--auto-sync "$(AUTO_SYNC)" \
		--auto-archive "$(AUTO_ARCHIVE)" \
		--state-dir "$(FLOW_STATE_DIR)" \
		--resume

# ---------------------------------------------------------------------------
# Полный цикл — пересборка конфига и валидация
# ---------------------------------------------------------------------------

sync: openspec-config openspec-validate ## Пересобрать config из vault/skills/ + валидировать схему
	@echo "✓ Готово к работе"
