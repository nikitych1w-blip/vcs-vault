# Интеграция с HashiCorp Vault

Настройка производится через переменные окружения (можно задать в файле .env).

Используется при загрузке конфигурации в заполнителях `{{ vault:<path>:<key> }}`.

## Обязательные параметры

| Переменная        | Описание                                                                                                  | Пример                           |
| ----------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| VAULT_ENABLED     | Включает/отключает подключение к Vault. Если true — используется реальный Vault, иначе — MockVaultService | true                             |
| VAULT_HOST        | Адрес Vault с протоколом и портом                                                                         | <https://vault.example.com:8200> |
| VAULT_MOUNT_POINT | Точка монтирования KV secrets engine                                                                      | secret                           |
| VAULT_KV_VERSION  | Версия KV secrets engine: 1 или 2                                                                         | 2                                |
| VAULT_ROLE_ID     | Role ID для аутентификации по AppRole                                                                     | abcd1234-role-id                 |
| VAULT_SECRET_ID   | Secret ID для аутентификации по AppRole                                                                   | efgh5678-secret-id               |

## Опциональные параметры

| Переменная        | Значение по умолчанию | Описание                              | Пример       |
| ----------------- | --------------------- | ------------------------------------- | ------------ |
| VAULT_NAMESPACE   | "root"                | Namespace в Vault (если используется) | admin/team-a |
| VAULT_SKIP_VERIFY | false                 | Отключает SSL верификацию             | true         |

## Пример

```env
# Включить Vault
VAULT_ENABLED=true
# Отключить проверку SSL
VAULT_SKIP_VERIFY=true

# Подключение к Vault
VAULT_HOST=https://vault.example.com:8200
VAULT_NAMESPACE=admin/team-a
VAULT_MOUNT_POINT=secret
VAULT_KV_VERSION=2

# Аутентификация по AppRole
VAULT_ROLE_ID=abcd1234-role-id-from-vault
VAULT_SECRET_ID=efgh5678-secret-id-from-vault
```
