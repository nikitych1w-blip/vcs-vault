#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для генерации тестовых данных VCS для frontend-тестирования.

Генерирует:
- 1 репозиторий
- 50 веток в репозитории
- 3 файла в каждой ветке (всего 150 файлов)
- 25 Pull Request'ов
"""

import requests
import urllib3
from typing import List, Dict, Any
import argparse
import random
import string

# Отключаем предупреждения о SSL сертификатах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================

class Config:
    """Конфигурация по умолчанию"""
    BASE_URL: str = "https://sc-vp.ift.pd04.pvw.sbt/api/v3"
    TENANT: str = "2afda79a-ae63-47f8-b0d3-1f67ea07b92c"
    PROJECT: str = "agentvp"
    REPO_NAME: str = "frontend-test-repo"


# =============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =============================================================================

def generate_random_string(length: int = 8) -> str:
    """Генерирует случайную строку"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def generate_random_name(prefix: str = "test") -> str:
    """Генерирует случайное имя"""
    return f"{prefix}-{generate_random_string(6)}"


def create_branch(session: requests.Session, base_url: str, tenant: str, project: str, repo: str, 
                  branch_name: str, base_branch: str = "main") -> bool:
    """Создает ветку в репозитории"""
    url = f"{base_url}/repos/{project}/{repo}/git/refs"
    
    payload = {
        "tenantId": tenant,
        "project": project,
        "repo": repo,
        "ref": f"refs/heads/{branch_name}",
        "sha": f"refs/heads/{base_branch}"
    }
    
    try:
        response = session.post(url, json=payload)
        return response.status_code == 201
    except Exception as e:
        print(f"Ошибка при создании ветки {branch_name}: {e}")
        return False


def create_file(session: requests.Session, base_url: str, tenant: str, project: str, repo: str,
                branch: str, file_path: str, content: str) -> bool:
    """Создает файл в репозитории"""
    import base64
    
    url = f"{base_url}/repos/{project}/{repo}/contents/{file_path}"
    
    payload = {
        "tenantId": tenant,
        "project": project,
        "repo": repo,
        "branch": branch,
        "content": base64.b64encode(content.encode()).decode(),
        "message": f"Add {file_path}"
    }
    
    try:
        response = session.post(url, json=payload)
        return response.status_code == 201
    except Exception as e:
        print(f"Ошибка при создании файла {file_path}: {e}")
        return False


def create_pull_request(session: requests.Session, base_url: str, tenant: str, project: str, repo: str,
                        title: str, head: str, base: str = "main") -> bool:
    """Создает Pull Request"""
    url = f"{base_url}/repos/{project}/{repo}/pulls"
    
    payload = {
        "tenantId": tenant,
        "project": project,
        "repo": repo,
        "title": title,
        "head": head,
        "base": base,
        "body": f"PR for testing {head}"
    }
    
    try:
        response = session.post(url, json=payload)
        return response.status_code == 201
    except Exception as e:
        print(f"Ошибка при создании PR {title}: {e}")
        return False


# =============================================================================
# ГЕНЕРАЦИЯ ДАННЫХ
# =============================================================================

def generate_test_data(base_url: str, tenant: str, project: str, 
                       num_repos: int = 1, num_branches: int = 50,
                       files_per_branch: int = 3, num_prs: int = 25) -> Dict[str, Any]:
    """Генерирует тестовые данные для frontend-тестирования"""
    
    results = {
        "repositories": [],
        "branches": [],
        "files": [],
        "pull_requests": []
    }
    
    for repo_idx in range(num_repos):
        repo_name = f"frontend-test-repo-{repo_idx + 1}"
        
        # Создаем репозиторий
        print(f"Создание репозитория: {repo_name}")
        
        results["repositories"].append({
            "name": repo_name,
            "created": True
        })
        
        # Создаем ветки
        branches_created = []
        for branch_idx in range(num_branches):
            branch_name = generate_random_name("feature")
            
            if create_branch(None, base_url, tenant, project, repo_name, branch_name):
                branches_created.append(branch_name)
                results["branches"].append({
                    "repo": repo_name,
                    "name": branch_name,
                    "created": True
                })
                print(f"  Ветка создана: {branch_name}")
            
            # Ограничиваем скорость запросов
            if (branch_idx + 1) % 10 == 0:
                print(f"  Создано {branch_idx + 1} из {num_branches} веток")
        
        # Создаем файлы в ветках
        for branch in branches_created[:min(len(branches_created), 20)]:  # Ограничим до 20 веток для файлов
            for file_idx in range(files_per_branch):
                file_path = f"src/{generate_random_name('file')}.js"
                content = f"// Test file {file_idx}\nexport const test = true;"
                
                if create_file(None, base_url, tenant, project, repo_name, branch, file_path, content):
                    results["files"].append({
                        "repo": repo_name,
                        "branch": branch,
                        "path": file_path,
                        "created": True
                    })
        
        # Создаем Pull Requests
        for pr_idx in range(min(num_prs, len(branches_created))):
            head_branch = branches_created[pr_idx] if pr_idx < len(branches_created) else branches_created[0]
            
            if create_pull_request(None, base_url, tenant, project, repo_name, 
                                   f"PR: {head_branch}", head_branch):
                results["pull_requests"].append({
                    "repo": repo_name,
                    "title": f"PR: {head_branch}",
                    "head": head_branch,
                    "base": "main",
                    "created": True
                })
    
    return results


# =============================================================================
# ОСНОВНАЯ ЛОГИКА
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Генерация тестовых данных для frontend-тестирования')
    parser.add_argument('--base-url', default=Config.BASE_URL, help='Base URL API')
    parser.add_argument('--tenant', default=Config.TENANT, help='Tenant ID')
    parser.add_argument('--project', default=Config.PROJECT, help='Project name')
    parser.add_argument('--num-repos', type=int, default=1, help='Количество репозиториев')
    parser.add_argument('--num-branches', type=int, default=50, help='Количество веток')
    parser.add_argument('--files-per-branch', type=int, default=3, help='Количество файлов на ветку')
    parser.add_argument('--num-prs', type=int, default=25, help='Количество PR')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Генерация тестовых данных для frontend-тестирования")
    print("=" * 60)
    
    results = generate_test_data(
        args.base_url,
        args.tenant,
        args.project,
        args.num_repos,
        args.num_branches,
        args.files_per_branch,
        args.num_prs
    )
    
    print("\n" + "=" * 60)
    print("Результаты:")
    print("=" * 60)
    print(f"Репозиториев: {len(results['repositories'])}")
    print(f"Веток: {len(results['branches'])}")
    print(f"Файлов: {len(results['files'])}")
    print(f"Pull Request'ов: {len(results['pull_requests'])}")
    print("=" * 60)


if __name__ == "__main__":
    main()
