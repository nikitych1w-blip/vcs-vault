#!/usr/bin/env python3
"""
Скрипт для генерации тестовых данных в SourceControl API v3.
Создает: проекты, репозитории, файлы, ветки, PR в разных статуса.

Алгоритм:
1. Создание репозитория через API
2. Клонирование репозитория
3. Создание файлов и веток локально
4. Git push
5. Создание PR через API

Примеры использования:
    python3 generate_vcs_data.py
    python3 generate_vcs_data.py --tenant abc-123 --project myproject --repos 5
    python3 generate_vcs_data.py --files 20 --branches 50 --pulls 25
    python3 generate_vcs_data.py --base-url https://api.example.com --token mytoken
"""

import requests
import random
import string
import json
import time
import urllib3
import subprocess
import os
import shutil
import base64
import argparse
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
from urllib.parse import urlparse


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Конфигурация по умолчанию
DEFAULTS = {
    "base_url": "https://sc-vp.ift.pd04.pvw.sbt/api/v3",
    "auth_token": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ3UlhJemQ1Zjk0dUVqaUUtZW0xVG1iNXNvU3JpMmYzTTVNTnVVakkxRjFzIn0.eyJleHAiOjE3NzkxODI4MjIsImlhdCI6MTc3OTE4MjUyMiwiYXV0aF90aW1lIjoxNzc5MTgyNTIyLCJqdGkiOiIxNDdmNmY5NC00NWJiLTQ0YmYtOTc5OC1kN2YyZDhmODcwZGUiLCJpc3MiOiJodHRwczovL2Rldi5wZDA0LnB2dy5zYnQvYXV0aC9yZWFsbXMvSUZUIiwiYXVkIjpbInRlc3Q6cm9sZSIsInRlc3Q6Z2dnIiwidGVzdDphdXRvaW4iLCJ0ZXN0OjNpZnQiLCJ0ZXN0OnF3ZSIsInRlc3Q6YXBpdiIsInRlc3Q6ZGVtbyIsInRlc3Q6aWRwIiwidGVzdDpzZHNkIiwidGVzdDo4ODk2ODg5OCIsInRlc3Q6aWZ0MSIsInRlc3Q6aWZ0MnByb2oiLCJ0ZXN0OmlmdDIiLCJ0ZXN0OnByaXZhdDEiLCJ0ZXN0OnRlc3QxMiIsInRlc3Q6aWZ0MyIsInRlc3Q6aWZ0NCIsInRlc3Q6YXNhcCIsInRlc3Q6b3JwaGFuIiwidGVzdDppZHBuZXciLCJ0ZXN0OmtidnAiLCJ0ZXN0OmRlbGV0ZSIsInRlc3Q6amIybms5IiwidGVzdCIsInRlc3Q6dGVzdCIsInRlc3Q6YWRtNSIsInRlc3Q6ZGVsZXRlMzMiLCJ0ZXN0OjEzNjY5MXAiLCJ0ZXN0OmFwaTEiLCJ0ZXN0OmNsdXN0ZXIiLCJ0ZXN0OmRlbHJlcCIsInRlc3Q6dm1xIiwidGVzdDprZXk4NjI2IiwidGVzdDprZXlwZXAiLCJ0ZXN0OnNjdnAiLCJ0ZXN0OjQ1MDR0MSIsInRlc3Q6a2V5IiwidGVzdDp2c2M0NTA0aSIsInRlc3Q6c2Rmc2RmIiwidGVzdDp3cjI0MyIsInRlc3Q6dnNjNDUwNGQiLCJ0ZXN0OnR0dHQiLCJ0ZXN0OnRlc3Rwcm9qIiwiYWNjb3VudCIsInRlc3Q6cmV0eSJdLCJzdWIiOiI3ZTU5ZTFkYi02YzE1LTQyOTgtYjNiZi0wOTM4N2IyNzFlMjIiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJvbmV3b3JrLWxvZ2luIiwibm9uY2UiOiJmMTA0ZDhmMGJhNGJmYzA5MTRjZjQ3YmFjODEyODNmYyIsInNlc3Npb25fc3RhdGUiOiJmMTZlNjgxYi0yYWZiLTRhYTYtYmNlMy1hYzZhMjBhODc1NWIiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVmYXVsdC1yb2xlcy1pZnQiLCJzY19hZG1pbiIsInNjX3VzZXIiLCJTU0RfVVNFUiIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJ0ZXN0OnJvbGUiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDpnZ2ciOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDphdXRvaW4iOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwib25ld29yay1sb2dpbiI6eyJyb2xlcyI6WyJST0xFX1VTRVIiLCJUVF9BUzIxX1JPTEVfVEVOQU5UX0FETUlOIl19LCJ0ZXN0OjNpZnQiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDpxd2UiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDphcGl2Ijp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6ZGVtbyI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmlkcCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OnNkc2QiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDo4ODk2ODg5OCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmlmdDEiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDppZnQycHJvaiI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmlmdDIiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDpwcml2YXQxIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6dGVzdDEyIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6aWZ0MyI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmlmdDQiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDphc2FwIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6b3JwaGFuIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6aWRwbmV3Ijp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6a2J2cCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmRlbGV0ZSI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmpiMm5rOSI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0Ijp7InJvbGVzIjpbIm9yZ2FuaXphdGlvbl9jb29yZGluYXRvciJdfSwidGVzdDp0ZXN0Ijp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6YWRtNSI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmRlbGV0ZTMzIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6MTM2NjkxcCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmFwaTEiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDpjbHVzdGVyIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6ZGVscmVwIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6dm1xIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6a2V5ODYyNiI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OmtleXBlcCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OnNjdnAiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDo0NTA0dDEiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDprZXkiOnsicm9sZXMiOlsicHJvamVjdF9jb29yZGluYXRvciJdfSwidGVzdDp2c2M0NTA0aSI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OnNkZnNkZiI6eyJyb2xlcyI6WyJvd25lciJdfSwidGVzdDp3cjI0MyI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OnZzYzQ1MDRkIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sInRlc3Q6dHR0dCI6eyJyb2xlcyI6WyJwcm9qZWN0X2Nvb3JkaW5hdG9yIl19LCJ0ZXN0OnRlc3Rwcm9qIjp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX0sImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfSwidGVzdDpyZXR5Ijp7InJvbGVzIjpbInByb2plY3RfY29vcmRpbmF0b3IiXX19LCJzY29wZSI6Im9wZW5pZCBlbWFpbCBwcm9maWxlIiwic2lkIjoiZjE2ZTY4MWItMmFmYi00YWE2LWJjZTMtYWM2YTIwYTg3NTViIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInNiZXJwZGkiOiJzYV92Y3NfYWRtaW41Iiwib3JnYW5pemF0aW9uIjoic2J0IiwibmFtZSI6InNhX3Zjc19hZG1pbjUgc2FfdmNzX2FkbWluNSIsImdyb3VwcyI6WyJST0xFX1VTRVIiLCJUVF9BUzIxX1JPTEVfVEVOQU5UX0FETUlOIiwiZGVmYXVsdC1yb2xlcy1pZnQiLCJzY19hZG1pbiIsInNjX3VzZXIiLCJTU0RfVVNFUiIsIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXSwicHJlZmVycmVkX3VzZXJuYW1lIjoic2FfdmNzX2FkbWluNSIsImdpdmVuX25hbWUiOiJzYV92Y3NfYWRtaW41IiwiZmFtaWx5X25hbWUiOiJzYV92Y3NfYWRtaW41IiwiZW1haWwiOiJzYV92Y3NfYWRtaW41QGxvY2FsLmxvY2FsIn0.XX7oYZI5_m9Itm6NKlXnFT6m8gmc-ozCwSdxMC9cdOSrvJfB5BC-qzz0JVaosPqtXM5y8NTvDCYfXu_XXSRL1Bm37oTFE-SlDsScb21oYHO62ZCTBGwVEmJA1iZORKUYYjxnGu1mBQbMdpTUlTPio5iAx-w3q8JUVE3TggLNrKeUFiQAJOO8mHz9HRZOYa_7O57GVld2BGJKd2tN_aqM4fMeJF0LU0cBFy65UYdSXOnq7v8zfcqqMp5tGMyddC3CoOf2wh3ot6cg5sEzq5ij161dkq9b7hXp8yxQS8ekUPaeyjF8f3ta8Z9_0dDW0TzzgCX0Rz93YGHr4vFrHDtC9A",
    "git_username": "sa_vcs_admin5",
    "git_password": "sa_vcs_admin5",
    "tenant": "2afda79a-ae63-47f8-b0d3-1f67ea07b92c",
    "project": "agentvp",
    "repos_count": 1,
    "files_per_repo": 10,
    "branches_per_repo": 100,
    "pulls_per_repo": 25,
    "local_repos_dir": "./local_repos",
    "git_user_name": "sa_vcs_admin5",
    "git_user_email": "sa_vcs_admin5@local.local",
}


def parse_args():
    """Парсит аргументы командной строки."""
    parser = argparse.ArgumentParser(
        description="Генератор тестовых данных для SourceControl API v3",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Примеры использования:
  %(prog)s  # Запуск с параметрами по умолчанию
  %(prog)s --tenant abc-123 --project myproject --repos 5
  %(prog)s --files 20 --branches 50 --pulls 25
  %(prog)s --base-url https://api.example.com --token mytoken
        """
    )
    
    # API параметры
    api_group = parser.add_argument_group("Параметры API")
    api_group.add_argument("--base-url", type=str, default=DEFAULTS["base_url"],
                          help=f"URL API SourceControl v3 (по умолчанию: {DEFAULTS['base_url']})")
    api_group.add_argument("--token", type=str, default=DEFAULTS["auth_token"],
                          help="JWT токен для авторизации в API")
    
    # Git параметры
    git_group = parser.add_argument_group("Параметры Git")
    git_group.add_argument("--git-username", type=str, default=DEFAULTS["git_username"],
                          help=f"Логин для git авторизации (по умолчанию: {DEFAULTS['git_username']})")
    git_group.add_argument("--git-password", type=str, default=DEFAULTS["git_password"],
                          help=f"Пароль для git авторизации (по умолчанию: {DEFAULTS['git_password']})")
    
    # Параметры генерации
    gen_group = parser.add_argument_group("Параметры генерации")
    gen_group.add_argument("--tenant", type=str, default=DEFAULTS["tenant"],
                          help=f"ID тенанта (по умолчанию: {DEFAULTS['tenant']})")
    gen_group.add_argument("--project", type=str, default=DEFAULTS["project"],
                          help=f"Имя проекта (по умолчанию: {DEFAULTS['project']})")
    gen_group.add_argument("--repos", type=int, default=DEFAULTS["repos_count"],
                          help=f"Количество репозиториев для создания (по умолчанию: {DEFAULTS['repos_count']})")
    gen_group.add_argument("--files", type=int, default=DEFAULTS["files_per_repo"],
                          help=f"Количество файлов в каждом репозитории (по умолчанию: {DEFAULTS['files_per_repo']})")
    gen_group.add_argument("--branches", type=int, default=DEFAULTS["branches_per_repo"],
                          help=f"Количество веток для создания (по умолчанию: {DEFAULTS['branches_per_repo']})")
    gen_group.add_argument("--pulls", type=int, default=DEFAULTS["pulls_per_repo"],
                          help=f"Количество PR для создания (по умолчанию: {DEFAULTS['pulls_per_repo']})")
    gen_group.add_argument("--local-dir", type=str, default=DEFAULTS["local_repos_dir"],
                          help=f"Директория для локальных клонов (по умолчанию: {DEFAULTS['local_repos_dir']})")
    gen_group.add_argument("--git-user-name", type=str, default=DEFAULTS["git_user_name"],
                          help=f"Имя пользователя git (по умолчанию: {DEFAULTS['git_user_name']})")
    gen_group.add_argument("--git-user-email", type=str, default=DEFAULTS["git_user_email"],
                          help=f"Email пользователя git (по умолчанию: {DEFAULTS['git_user_email']})")
    gen_group.add_argument("--repo-prefix", type=str, default="repo-agent",
                          help=f"Префикс для названия репозитория (по умолчанию: repo-agent)")
    
    return parser.parse_args()


# Парсим аргументы
args = parse_args()

# Инициализируем конфигурацию из аргументов
BASE_URL = args.base_url
AUTH_TOKEN = args.token
GIT_USERNAME = args.git_username
GIT_PASSWORD = args.git_password

CONFIG = {
    "tenant": args.tenant,
    "project": args.project,
    "repos_count": args.repos,
    "files_per_repo": args.files,
    "branches_per_repo": args.branches,
    "pulls_per_repo": args.pulls,
    "pr_states": ["open", "open", "closed"],
    "local_repos_dir": args.local_dir,
    "git_user_name": args.git_user_name,
    "git_user_email": args.git_user_email,
    "repo_prefix": args.repo_prefix,
}

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Content-Type": "application/json"
}

def random_string(length: int = 8) -> str:
    """Генерирует случайную строку."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def random_content(file_type: str) -> str:
    """Генерирует случайное содержимое файла в зависимости от типа."""
    if file_type == "py":
        module_name = random_string(10)
        now = datetime.now().isoformat()
        rand_val = random.randint(1, 1000)
        rand_mult = random.randint(1, 10)
        rand_items = [random.randint(1, 100) for _ in range(5)]
        debug_val = random.choice([True, False])
        return f'''#!/usr/bin/env python3
"""
Module: {module_name}.py
Generated: {now}
"""

import random
import logging

logger = logging.getLogger(__name__)

CONFIG_VALUE = {rand_val}
DEBUG_MODE = {debug_val}

def process_data(data: list) -> dict:
    result = {{}}
    for item in data:
        key = f"item_{{len(result)}}"
        result[key] = item * {rand_mult}
    return result

def main():
    sample_data = {rand_items}
    processed = process_data(sample_data)
    logger.info(f"Processed: {{processed}}")
    return processed

if __name__ == "__main__":
    main()
'''
    elif file_type == "js":
        return f'''/**
 * Module: {random_string(10)}.js
 * Generated: {datetime.now().isoformat()}
 */

const CONFIG = {{
    apiUrl: 'https://api.example.com/v1',
    timeout: {random.randint(1000, 10000)},
    retries: {random.randint(1, 5)}
}};

class DataProcessor {{
    constructor(options = {{}}) {{
        this.options = {{ ...CONFIG, ...options }};
        this.cache = new Map();
    }}

    async fetchData(endpoint) {{
        const cached = this.cache.get(endpoint);
        if (cached) return cached;
        
        const response = await fetch(this.options.apiUrl + endpoint);
        const data = await response.json();
        this.cache.set(endpoint, data);
        return data;
    }}

    transformData(input) {{
        return Object.entries(input).map(([key, value]) => ({{
            id: `{{key}}_{{Date.now()}}`,
            value: value * {random.randint(1, 10)},
            timestamp: new Date().toISOString()
        }}));
    }}
}}

module.exports = {{ DataProcessor, CONFIG }};
'''
    elif file_type == "ts":
        return f'''/**
 * Module: {random_string(10)}.ts
 * Generated: {datetime.now().isoformat()}
 */

interface Config {{
    apiUrl: string;
    timeout: number;
    retries: number;
}}

const CONFIG: Config = {{
    apiUrl: 'https://api.example.com/v1',
    timeout: {random.randint(1000, 10000)},
    retries: {random.randint(1, 5)}
}};

class DataProcessor {{
    private cache: Map<string, unknown> = new Map();
    private options: Config;

    constructor(options?: Partial<Config>) {{
        this.options = {{ ...CONFIG, ...options }};
    }}

    async fetchData(endpoint: string): Promise<unknown> {{
        const cached = this.cache.get(endpoint);
        if (cached) return cached;
        
        const response = await fetch(this.options.apiUrl + endpoint);
        const data = await response.json();
        this.cache.set(endpoint, data);
        return data;
    }}

    transformData(input: Record<string, number>) {{
        return Object.entries(input).map(([key, value]) => ({{
            id: `{{key}}_{{Date.now()}}`,
            value: value * {random.randint(1, 10)},
            timestamp: new Date().toISOString()
        }}));
    }}
}}

export {{ DataProcessor, CONFIG }};
'''
    elif file_type == "java":
        return f'''package com.example.module{random_string(5)};

import java.util.*;

public class DataProcessor{random_string(4).title()} {{
    private static final int CONFIG_VALUE = {random.randint(1, 1000)};
    
    public List<Integer> processData(List<Integer> input) {{
        return input.stream()
            .map(value -> value * {random.randint(1, 10)})
            .collect(Collectors.toList());
    }}
    
    public static void main(String[] args) {{
        DataProcessor{random_string(4).title()} processor = new DataProcessor{random_string(4).title()}();
        List<Integer> result = processor.processData(Arrays.asList(1, 2, 3));
        System.out.println("Processed: " + result);
    }}
}}
'''
    elif file_type == "go":
        return f'''package main

import (
    "fmt"
    "time"
)

const ConfigValue = {random.randint(1, 1000)}

type DataItem struct {{
    ID        string
    Value     int
    Timestamp time.Time
}}

func main() {{
    items := []DataItem{{
        {{ID: "item1", Value: {random.randint(1, 100)}, Timestamp: time.Now()}},
    }}
    fmt.Printf("Processed: %v\\n", items)
}}
'''
    elif file_type == "rs":
        return f'''//! Generated module: {random_string(10)}
//! Date: {datetime.now().isoformat()}

const CONFIG_VALUE: i32 = {random.randint(1, 1000)};

#[derive(Debug)]
struct DataItem {{
    id: String,
    value: i32,
}}

fn main() {{
    let item = DataItem {{
        id: String::from("item1"),
        value: {random.randint(1, 100)},
    }};
    println!("Processed: {{:?}}", item);
}}
'''
    elif file_type == "md":
        return f'''# Documentation: {random_string(10).title()}

## Overview

This is auto-generated documentation for testing purposes.

## Configuration

| Parameter | Value |
|-----------|-------|
| timeout | {random.randint(1000, 10000)} |
| retries | {random.randint(1, 5)} |

## Usage

```python
from module import DataProcessor
```

Generated: {datetime.now().isoformat()}
'''
    elif file_type == "json":
        return json.dumps({
            "name": f"test-{random_string(8)}",
            "version": f"{random.randint(1, 5)}.{random.randint(0, 9)}.{random.randint(0, 9)}",
            "config": {
                "timeout": random.randint(1000, 10000),
                "retries": random.randint(1, 5)
            },
            "items": [random.randint(1, 100) for _ in range(5)]
        }, indent=2)
    elif file_type == "yaml":
        return f'''# Generated configuration
name: test-{random_string(8)}
version: {random.randint(1, 5)}.{random.randint(0, 9)}.{random.randint(0, 9)}

config:
  timeout: {random.randint(1000, 10000)}
  retries: {random.randint(1, 5)}

metadata:
  generated: {datetime.now().isoformat()}
'''
    elif file_type == "sql":
        return f'''-- Generated SQL script
CREATE TABLE IF NOT EXISTS test_data_{random_string(8)} (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value INTEGER DEFAULT {random.randint(1, 100)}
);

INSERT INTO test_data_{random_string(8)} (name, value)
VALUES ('item_{random_string(5)}', {random.randint(1, 100)});
'''
    elif file_type == "sh":
        return f'''#!/bin/bash
# Generated script: {random_string(10)}

CONFIG_VALUE={random.randint(1, 1000)}

log() {{
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}}

main() {{
    log "Starting script..."
    for i in {{1..5}}; do
        log "Processing item $i"
    done
    log "Script completed!"
}}

main "$@"
'''
    else:  # txt
        return f'''Generated file: {random_string(10)}.txt
Date: {datetime.now().isoformat()}
Random value: {random.randint(1, 1000)}

This is a test file with some content.
Configuration value: {random.randint(1, 100)}
'''


def get_file_extensions() -> List[str]:
    """Возвращает список расширений файлов для генерации."""
    return ["py", "js", "ts", "java", "go", "rs", "md", "json", "yaml", "sql", "sh", "txt"]


def run_git_command(repo_dir: str, *args: str, check: bool = True, timeout: int = 300) -> subprocess.CompletedProcess:
    """Выполняет Git команду в указанной директории."""
    cmd = ["git"] + list(args)
    try:
        result = subprocess.run(
            cmd,
            cwd=repo_dir,
            capture_output=True,
            text=True,
            check=check,
            timeout=timeout
        )
        return result
    except subprocess.TimeoutExpired:
        print(f"  ❌ Таймаут команды: {' '.join(cmd)}")
        raise
    except subprocess.CalledProcessError as e:
        if not check:
            return e
        print(f"  ❌ Ошибка git: {e.stderr}")
        raise


def make_request(method: str, url: str, data: Optional[Dict] = None, params: Optional[Dict] = None) -> Optional[Dict]:
    """Выполняет HTTP запрос с обработкой ошибок."""
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=HEADERS,
            json=data,
            params=params,
            timeout=30,
            verify=False
        )
        
        if response.status_code >= 400:
            print(f"  ❌ Ошибка {response.status_code}: {response.text[:300] if response.text else 'No details'}")
            return None
        
        if response.status_code == 204:
            return {"status": "success"}
        
        return response.json() if response.text else {"status": "success"}
    
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Ошибка запроса: {e}")
        return None


def get_git_clone_url(tenant: str, project: str, repo: str) -> str:
    """Получает URL для клонирования репозитория."""
    # Извлекаем поддомен из base_url (например, sc-vp, sc-ift1, sc-ift2, sc-ift3, sc-ift4)
    parsed = urlparse(BASE_URL)
    subdomain = parsed.hostname.split('.')[0] if parsed.hostname else 'sc-vp'
    # Универсальное решение для всех стендов: sc-ift1, sc-ift2, sc-ift3, sc-ift4, sc-vp
    return f"https://ift.pd04.pvw.sbt/ssd/tools/{subdomain}/{project}/{repo}.git"


def create_repository(tenant: str, project: str, repo_name: str, description: str = "") -> Optional[Dict]:
    """Создает репозиторий через API."""
    print(f"  📦 Создание репозитория: {repo_name}")
    
    url = f"{BASE_URL}/repos/{tenant}/{project}"
    data = {
        "name": repo_name,
        "auto_init": False,
        "description": description or f"Test repository generated at {datetime.now().isoformat()}"
    }
    
    result = make_request("POST", url, data=data)
    if result:
        print(f"     ✅ Репозиторий создан: {tenant}/{project}/{repo_name}")
    return result


def clone_repository(clone_url: str, local_dir: str) -> bool:
    """Клонирует репозиторий локально."""
    parsed = urlparse(clone_url)
    
    if GIT_USERNAME and GIT_PASSWORD:
        clone_url_with_auth = f"https://{GIT_USERNAME}:{GIT_PASSWORD}@{parsed.netloc}{parsed.path}"
    else:
        clone_url_with_auth = clone_url
        print("  ⚠️ GIT_USERNAME или GIT_PASSWORD не указаны")
    
    print(f"  📥 Клонирование репозитория из {clone_url}...")
    
    parent_dir = os.path.dirname(local_dir)
    repo_name = os.path.basename(local_dir)
    
    if os.path.exists(local_dir):
        shutil.rmtree(local_dir)
    
    os.makedirs(parent_dir, exist_ok=True)
    
    try:
        cmd = ["git", "clone", clone_url_with_auth, repo_name]
        result = subprocess.run(
            cmd,
            cwd=parent_dir,
            capture_output=True,
            text=True,
            check=True,
            timeout=300
        )
        print(f"     ✅ Репозиторий склонирован в {local_dir}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Ошибка клонирования: {e.stderr}")
        return False
    except subprocess.TimeoutExpired:
        print(f"  ❌ Таймаут клонирования (300 сек)")
        return False


def create_file_locally(repo_dir: str, file_path: str, content: str) -> bool:
    """Создает файл локально в репозитории."""
    full_path = os.path.join(repo_dir, file_path)
    
    dir_path = os.path.dirname(full_path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)
    
    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"  ❌ Ошибка создания файла {file_path}: {e}")
        return False


def commit_changes(repo_dir: str, message: str) -> Optional[str]:
    """Делает коммит изменений только в пределах репозитория."""
    try:
        run_git_command(repo_dir, "add", ".")
        run_git_command(repo_dir, "commit", "-m", message)
        
        result = run_git_command(repo_dir, "rev-parse", "HEAD")
        sha = result.stdout.strip()
        print(f"     ✅ Коммит: {message[:50]}... ({sha[:8]})")
        return sha
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Ошибка коммита: {e.stderr}")
        return None


def create_branch_locally(repo_dir: str, branch_name: str, base_branch: str = "main", 
                          create_files: bool = False, file_count: int = 1, 
                          push_immediately: bool = False, git_auth_url: str = None) -> bool:
    """Создает ветку локально и опционально пушит её."""
    try:
        run_git_command(repo_dir, "checkout", base_branch, check=False, timeout=60)
        run_git_command(repo_dir, "checkout", "-b", branch_name, timeout=60)
        
        if create_files and file_count > 0:
            file_extensions = get_file_extensions()
            for i in range(file_count):
                ext = random.choice(file_extensions)
                dir_path = random.choice(["", "src/", "lib/", "utils/", "tests/", "docs/", "config/"])
                file_name = f"{random_string(8)}.{ext}"
                file_path = f"{dir_path}{file_name}"
                content = random_content(ext)
                create_file_locally(repo_dir, file_path, content)
            
            commit_changes(repo_dir, f"Add files in {branch_name}")
        
        if push_immediately:
            try:
                # Обновляем авторизацию в remote URL перед каждым пушем
                if git_auth_url:
                    run_git_command(repo_dir, "remote", "set-url", "origin", git_auth_url, check=False)
                run_git_command(repo_dir, "push", "-u", "--force", "origin", branch_name, timeout=120)
                print(f"     ✅ Ветка {branch_name} запушена")
            except subprocess.CalledProcessError as e:
                print(f"  ❌ Ошибка пуша ветки {branch_name}: {e.stderr}")
                return False
        
        print(f"     ✅ Ветка создана: {branch_name}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Ошибка создания ветки {branch_name}: {e.stderr}")
        return False


def create_pull_request(tenant: str, project: str, repo: str, 
                        title: str, description: str, 
                        head_branch: str, base_branch: str = "main") -> Optional[Dict]:
    """Создает Pull Request через API."""
    url = f"{BASE_URL}/repos/{tenant}/{project}/{repo}/pulls"
    data = {
        "title": title,
        "body": description,
        "head": head_branch,
        "base": base_branch
    }
    
    result = make_request("POST", url, data=data)
    if result:
        print(f"     ✅ PR создан: #{result.get('number', 'N/A')} - {title}")
    return result


def merge_pull_request(tenant: str, project: str, repo: str, pr_number: int, 
                       merge_method: str = "merge") -> Optional[Dict]:
    """Объединяет Pull Request через API."""
    url = f"{BASE_URL}/repos/{tenant}/{project}/{repo}/pulls/{pr_number}/merge"
    data = {"merge_method": merge_method}
    
    result = make_request("POST", url, data=data)
    if result:
        print(f"     ✅ PR #{pr_number} объединен методом: {merge_method}")
    return result


def decline_pull_request(tenant: str, project: str, repo: str, pr_number: int, 
                         comment: str = "") -> Optional[Dict]:
    """Отклоняет Pull Request через API."""
    url = f"{BASE_URL}/repos/{tenant}/{project}/{repo}/pulls/{pr_number}/decline"
    data = {"comment": comment or "Automatically declined by test generator"}
    
    result = make_request("POST", url, data=data)
    if result:
        print(f"     ✅ PR #{pr_number} отклонен")
    return result


def generate_pr_title() -> str:
    """Генерирует случайный заголовок для PR."""
    prefixes = ["feat:", "fix:", "chore:", "docs:", "refactor:", "test:", "style:", "perf:"]
    subjects = ["add new feature", "fix critical bug", "update dependencies",
                "improve performance", "refactor module", "add tests"]
    return f"{random.choice(prefixes)} {random.choice(subjects)}"


def generate_pr_description() -> str:
    """Генерирует случайное описание для PR."""
    return f"""## Changes

- Implemented new functionality
- Fixed existing bugs
- Updated dependencies

## Testing

- [x] Unit tests passed
- [x] Integration tests passed

## Related Issues

Closes #{random.randint(1, 100)}
"""


def populate_repository(tenant: str, project: str, repo: str) -> Dict:
    """Заполняет репозиторий: клонирует, создает файлы и ветки локально, пушит, создает PR."""
    stats = {
        "files_created": 0,
        "branches_created": 0,
        "pulls_created": 0,
        "success": True
    }
    
    local_dir = os.path.join(CONFIG["local_repos_dir"], f"{tenant}_{project}_{repo}")
    clone_url = get_git_clone_url(tenant, project, repo)
    
    print(f"  📡 URL для клонирования: {clone_url}")
    
    if not clone_repository(clone_url, local_dir):
        print("  ⚠️ Не удалось склонировать репозиторий, пробуем создать локально...")
        os.makedirs(local_dir, exist_ok=True)
        run_git_command(local_dir, "init")
        run_git_command(local_dir, "config", "user.name", CONFIG["git_user_name"])
        run_git_command(local_dir, "config", "user.email", CONFIG["git_user_email"])
        
        readme_content = f"# {repo}\n\nTest repository.\n"
        with open(os.path.join(local_dir, "README.md"), 'w') as f:
            f.write(readme_content)
        commit_changes(local_dir, "Initial commit")
        
        run_git_command(local_dir, "remote", "add", "origin", clone_url, check=False)
    
    created_branches = ["main"]
    created_pr_heads = set()  # Отслеживаем head-ветки созданных PR
    
    print(f"  📄 Создание {CONFIG['files_per_repo']} файлов в main ветке...")
    file_extensions = get_file_extensions()
    
    for i in range(CONFIG["files_per_repo"]):
        ext = random.choice(file_extensions)
        dir_path = random.choice(["", "src/", "lib/", "utils/", "tests/", "docs/", "config/"])
        file_name = f"{random_string(8)}.{ext}"
        file_path = f"{dir_path}{file_name}"
        content = random_content(ext)
        
        if create_file_locally(local_dir, file_path, content):
            stats["files_created"] += 1
        
        if (i + 1) % 10 == 0:
            print(f"     Создано файлов: {i + 1}/{CONFIG['files_per_repo']}")
    
    commit_changes(local_dir, f"Add {CONFIG['files_per_repo']} generated files to main")
    
    use_auth = bool(GIT_USERNAME and GIT_PASSWORD)
    if use_auth:
        try:
            result = run_git_command(local_dir, "remote", "get-url", "origin", check=False)
            if result.returncode == 0:
                remote_url = result.stdout.strip()
                if "@" not in remote_url and remote_url.startswith("https://"):
                    parsed = urlparse(remote_url)
                    auth_url = f"https://{GIT_USERNAME}:{GIT_PASSWORD}@{parsed.netloc}{parsed.path}"
                    run_git_command(local_dir, "remote", "set-url", "origin", auth_url, check=False)
                    print(f"  🔐 Настроена авторизация для remote origin")
        except Exception:
            pass
    
    print("  📤 Пуш main ветки...")
    try:
        run_git_command(local_dir, "push", "-u", "--force", "origin", "main", timeout=120)
        print(f"     ✅ Ветка main запушена")
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Ошибка пуша main: {e.stderr}")
    
    print(f"  🌿 Создание {CONFIG['branches_per_repo']} веток с уникальными файлами и их пуш...")
    branch_types = ["feature", "bugfix", "hotfix", "release", "chore"]
    
    # Создаем авторизованный URL для пуша
    git_auth_url = None
    if GIT_USERNAME and GIT_PASSWORD:
        parsed = urlparse(clone_url)
        git_auth_url = f"https://{GIT_USERNAME}:{GIT_PASSWORD}@{parsed.netloc}{parsed.path}"
    
    for i in range(CONFIG["branches_per_repo"]):
        branch_type = random.choice(branch_types)
        branch_name = f"{branch_type}/{random_string(6)}-{random.randint(1, 100)}"
        
        if create_branch_locally(local_dir, branch_name, "main", create_files=True, file_count=random.randint(1, 2), push_immediately=True, git_auth_url=git_auth_url):
            stats["branches_created"] += 1
            created_branches.append(branch_name)
        
        run_git_command(local_dir, "checkout", "main", check=False, timeout=60)
        
        if (i + 1) % 10 == 0:
            print(f"     Создано и запушено веток: {i + 1}/{CONFIG['branches_per_repo']}")
    
    run_git_command(local_dir, "checkout", "main", check=False)
    
    print(f"  🔀 Создание {CONFIG['pulls_per_repo']} PR через API...")
    pr_states = CONFIG["pr_states"].copy()
    random.shuffle(pr_states)
    
    # Перемешиваем ветки для случайного выбора
    available_branches = [b for b in created_branches if b != "main"]
    random.shuffle(available_branches)
    branch_index = 0
    
    for i in range(CONFIG["pulls_per_repo"]):
        if len(created_branches) < 2 or branch_index >= len(available_branches):
            break
            
        head_branch = available_branches[branch_index]
        branch_index += 1
        
        # Пропускаем уже использованные ветки
        if head_branch in created_pr_heads:
            continue
        
        # Генерируем уникальный заголовок с номером PR
        pr_num = i + 1
        prefixes = ["feat", "fix", "chore", "docs", "refactor", "test", "style", "perf"]
        subjects = ["add-new-feature", "fix-critical-bug", "update-deps",
                    "improve-performance", "refactor-module", "add-tests"]
        title = f"{random.choice(prefixes)}-{random.choice(subjects)}-{random_string(4)}-{pr_num}"
        description = generate_pr_description()
        
        pr_result = create_pull_request(
            tenant, project, repo, 
            title, description, 
            head_branch, "main"
        )
        
        if pr_result:
            stats["pulls_created"] += 1
            created_pr_heads.add(head_branch)  # Добавляем ветку в множество использованных
            pr_number = pr_result.get("number")
            pr_state = pr_states[i % len(pr_states)] if pr_states else "open"
            
            if pr_state == "closed" and pr_number:
                if random.choice([True, False]):
                    merge_pull_request(tenant, project, repo, pr_number, 
                                      random.choice(["merge", "squash", "rebase"]))
                else:
                    decline_pull_request(tenant, project, repo, pr_number,
                                        "Not meeting quality standards")
        
        if (i + 1) % 10 == 0:
            print(f"     Создано PR: {i + 1}/{CONFIG['pulls_per_repo']}")
        
        time.sleep(0.05)
    
    return stats


def main():
    """Основная функция."""
    print("=" * 60)
    print("🚀 Генератор тестовых данных для SourceControl API v3")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Tenant: {CONFIG['tenant']}")
    print(f"Project: {CONFIG['project']}")
    print(f"Репозиториев: {CONFIG['repos_count']}")
    print(f"Файлов в репозитории: {CONFIG['files_per_repo']}")
    print(f"Веток в репозитории: {CONFIG['branches_per_repo']}")
    print(f"PR в репозитории: {CONFIG['pulls_per_repo']}")
    print("=" * 60)
    
    print("\n🔍 Проверка подключения к API...")
    try:
        response = requests.get(
            f"{BASE_URL}/repos/{CONFIG['tenant']}/{CONFIG['project']}",
            headers=HEADERS,
            timeout=10,
            verify=False
        )
        if response.status_code in (200, 404):
            print("  ✅ Подключение успешно!")
        else:
            print(f"  ⚠️ Статус ответа: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Ошибка подключения: {e}")
        return
    
    print("\n🔍 Проверка наличия git...")
    try:
        result = subprocess.run(["git", "--version"], capture_output=True, text=True, check=True)
        print(f"  ✅ Git найден: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  ❌ Git не найден!")
        return
    
    os.makedirs(CONFIG["local_repos_dir"], exist_ok=True)
    
    tenant = CONFIG["tenant"]
    project = CONFIG["project"]
    git_auth_token = AUTH_TOKEN
    
    total_stats = {
        "files_created": 0,
        "branches_created": 0,
        "pulls_created": 0,
        "repos_created": 0
    }
    
    for repo_num in range(CONFIG["repos_count"]):
        repo_name = f"{CONFIG['repo_prefix']}-{repo_num + 1}-{random_string(4)}"
        
        result = create_repository(tenant, project, repo_name)
        
        if result:
            total_stats["repos_created"] += 1
            
            stats = populate_repository(tenant, project, repo_name)
            
            total_stats["files_created"] += stats.get("files_created", 0)
            total_stats["branches_created"] += stats.get("branches_created", 0)
            total_stats["pulls_created"] += stats.get("pulls_created", 0)
        
        time.sleep(0.5)
    
    print("\n" + "=" * 60)
    print("✅ Генерация данных завершена!")
    print("=" * 60)
    print(f"📊 Статистика:")
    print(f"   Репозиториев создано: {total_stats['repos_created']}")
    print(f"   Файлов создано: {total_stats['files_created']}")
    print(f"   Веток создано: {total_stats['branches_created']}")
    print(f"   PR создано: {total_stats['pulls_created']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
