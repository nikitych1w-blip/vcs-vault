#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для импорта тест кейсов в TMS систему через API.
Для Frontend-тестирования (UI/FE).

Поддерживаемый формат:
## TC-001
**Id:** TC-001
**Название:** [Название]
**Приоритет:** critical/major/minor
**Уровень теста:** ui
**Теги:** ui, [функционал], web2
**Шаги:**
**Шаг 1:** [описание]
**Тестовые данные:** [данные]
**Ожидаемый результат:** [результат]
"""

import re
import json
import base64
import requests
import urllib3
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import argparse
from dataclasses import dataclass

# Отключаем предупреждения о SSL сертификатах
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================

@dataclass(frozen=True)
class Config:
    """Конфигурация по умолчанию"""
    BASE_URL: str = "https://portal.works.prod.sbt/swtr"
    TEST_CASE_API: str = "https://portal.works.prod.sbt/swtr/rest/api/unit/v2/test_case/create"
    TEST_CYCLE_API: str = "https://portal.works.prod.sbt/swtr/rest/api/unit/v2/test_cycle/create"
    FOLDER_API: str = "https://portal.works.prod.sbt/swtr/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/folder/root"
    FOLDER_CREATE_API: str = "https://portal.works.prod.sbt/swtr/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/folder/create"
    LINK_API: str = "https://portal.works.prod.sbt/swtr/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/link"
    SPACE: str = "VCS"
    USERNAME: str = ""
    PASSWORD: str = ""
    DEFAULT_FILES: Tuple[str, ...] = ("test_cases.md", "shablon.md")

# Маппинг приоритетов и уровней тестирования
PRIORITY_MAP = {"critical": "critical", "major": "major", "minor": "minor", "trivial": "trivial"}
TEST_LEVEL_MAP = {"api": "api", "ui": "ui", "integration": "integration", "system": "system", "acceptance": "acceptance"}

# Поля attributes по умолчанию
DEFAULT_ATTRIBUTES = {
    "Automation_framework": None, "estimate": None, "owner": None, "precondition": None,
    "component_version": None, "product_version": None, "CRPV_STS_SUPPORT": None,
    "old_jira_key": None, "premigration_author": None, "target_fp": None,
    "product_name": None, "product_code": None, "component_code": None,
    "AftTestCaseName": None, "spec_for": None, "more_than_1": None,
    "case_version_relevant_from": None, "not_updated_since_version": None,
    "fb_testcase": None, "subsystem_szi": None, "module_szi": None,
    "interfaces": None, "price": None,
}


# =============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =============================================================================

@dataclass
class TestCase:
    """Структура тест-кейса"""
    id: str
    name: str
    priority: str
    test_level: str
    tags: List[str]
    steps: List[Dict[str, str]]
    node: Optional[str] = None
    api_version: Optional[str] = None


def parse_test_case(file_path: str) -> List[TestCase]:
    """Парсит тест-кейсы из markdown файла"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Разделяем на тест-кейсы по заголовкам TC-XXX
    test_cases = []
    
    # Ищем все блоки TC-XXX
    tc_pattern = r'## (TC-\d+):\s*(.+?)\n(.*?)(?=\n## TC-\d+:|\n## Приложения:|\Z)'
    matches = re.findall(tc_pattern, content, re.DOTALL)
    
    if not matches:
        # Альтернативный паттерн для поиска
        tc_pattern = r'### TC-\d+:\s*(.+?)\n(.*?)(?=\n### TC-\d+:|\Z)'
        matches = re.findall(tc_pattern, content, re.DOTALL)
    
    for match in matches:
        tc_id = match[0].strip()
        name = match[1].strip() if len(match) > 1 else ""
        body = match[2] if len(match) > 2 else ""
        
        # Извлекаем данные из тела
        priority_match = re.search(r'\*\*Приоритет:\*\*\s*(\w+)', body)
        priority = priority_match.group(1) if priority_match else "major"
        
        level_match = re.search(r'\*\*Уровень теста:\*\*\s*(\w+)', body)
        test_level = level_match.group(1) if level_match else "ui"
        
        tags_match = re.search(r'\*\*Теги:\*\*\s*(.+?)\n', body)
        tags = [t.strip() for t in tags_match.group(1).split(',')] if tags_match else []
        
        # Извлекаем шаги
        steps = []
        step_pattern = r'\*\*Шаг (\d+):\*\*\s*(.+?)\n\*\*Тестовые данные:\*\*\s*(.+?)\n\*\*Ожидаемый результат:\*\*\s*(.+?)(?=\n\*\*Шаг \d+:\*\*|\n\*\*Связанные узлы:\*\*|\Z)'
        step_matches = re.findall(step_pattern, body, re.DOTALL)
        
        for step_match in step_matches:
            steps.append({
                "step": step_match[0],
                "description": step_match[1].strip(),
                "data": step_match[2].strip(),
                "expected": step_match[3].strip()
            })
        
        test_cases.append(TestCase(
            id=tc_id,
            name=name,
            priority=priority,
            test_level=test_level,
            tags=tags,
            steps=steps,
            node=None,
            api_version=None
        ))
    
    return test_cases


def create_formatted_text(text: str, element_id: str) -> str:
    """Создает JSON-структуру для formattedText"""
    return json.dumps({
        "type": "doc",
        "content": [{
            "type": "paragraph",
            "attrs": {"id": element_id, "indent": 0, "textAlign": "justify"},
            "content": [{"type": "text", "text": text}]
        }]
    }, ensure_ascii=False)


def create_step_dict(step_num: int, desc: str, data: str, result: str, space: str = "VCS") -> Dict[str, Any]:
    """Создает словарь шага тест кейса"""
    return {
        "code": None,
        "stepDescription": {
            "formattedText": create_formatted_text(desc, f"step-{step_num}")
        },
        "stepData": {
            "formattedText": create_formatted_text(data, f"data-{step_num}")
        },
        "result": {
            "formattedText": create_formatted_text(result, f"result-{step_num}")
        },
        "attributes": []
    }


def create_test_case_payload(tc: TestCase, folder_id: Optional[str] = None, space: str = "VCS") -> Dict[str, Any]:
    """Создает payload для создания тест-кейса"""
    steps = []
    for i, step in enumerate(tc.steps, 1):
        steps.append(create_step_dict(
            i,
            step["description"],
            step["data"],
            step["expected"]
        ))
    
    # Создаем описание тест-кейса
    description_parts = []
    if tc.node:
        description_parts.append(f"**Узел**: {tc.node}")
    if tc.api_version:
        description_parts.append(f"**Версия API**: {tc.api_version}")
    
    if tc.tags:
        description_parts.append(f"**Теги**: {', '.join(tc.tags)}")
    
    description = '\n'.join(description_parts)
    
    # Добавляем шаги
    description += "\n\n### Шаги\n\n"
    for step in tc.steps:
        description += f"**Шаг {step['step']}**: {step['description']}\n\n**Тестовые данные**: {step['data']}\n\n**Ожидаемый результат**: {step['expected']}\n\n"
    
    return {
        "folder": folder_id,
        "space": space,
        "summary": {
            "name": tc.name,
            "formattedText": create_formatted_text(tc.name, "name")
        },
        "description": {
            "formattedText": create_formatted_text(description, "description")
        },
        "attributes": {
            "priority": PRIORITY_MAP.get(tc.priority, "major"),
            "testLevel": TEST_LEVEL_MAP.get(tc.test_level, "ui"),
            "Automation_framework": None,
            "estimate": None,
            "owner": None,
            "precondition": None,
            "component_version": None,
            "product_version": None,
            "CRPV_STS_SUPPORT": None,
            "old_jira_key": None,
            "premigration_author": None,
            "target_fp": None,
            "product_name": None,
            "product_code": None,
            "component_code": None,
            "AftTestCaseName": None,
            "spec_for": None,
            "more_than_1": None,
            "case_version_relevant_from": None,
            "not_updated_since_version": None,
            "fb_testcase": None,
            "subsystem_szi": None,
            "module_szi": None,
            "interfaces": None,
            "price": None
        },
        "steps": steps,
        "customFieldValues": []
    }


def create_folder(session: requests.Session, folder_name: str, parent_id: Optional[str] = None, space: str = "VCS") -> Optional[str]:
    """Создает папку в TMS"""
    url = Config.FOLDER_CREATE_API
    
    payload = {
        "name": folder_name,
        "type": "TEST_CASE",
        "spaceId": {"code": space}
    }
    
    if parent_id:
        payload["parentId"] = parent_id
    
    response = session.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("id", data.get("folderId"))
    
    return None


def get_folder_structure(session: requests.Session, space: str = "VCS") -> Dict[str, Any]:
    """Получает структуру папок в TMS"""
    url = Config.FOLDER_API
    
    payload = {
        "type": "TEST_CASE",
        "spaceId": {"code": space}
    }
    
    response = session.post(url, json=payload)
    
    if response.status_code == 200:
        return response.json()
    
    return {}


def create_test_case(session: requests.Session, payload: Dict[str, Any]) -> Optional[str]:
    """Создает тест-кейс в TMS"""
    response = session.post(Config.TEST_CASE_API, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("id", data.get("test_case_id"))
    
    return None


def create_test_cycle(session: requests.Session, name: str, folder_id: str, space: str = "VCS") -> Optional[str]:
    """Создает тест-цикл в TMS"""
    url = Config.TEST_CYCLE_API
    
    payload = {
        "name": name,
        "folder": folder_id,
        "space": space
    }
    
    response = session.post(url, json=payload)
    
    if response.status_code == 200:
        data = response.json()
        return data.get("id", data.get("test_cycle_id"))
    
    return None


def link_test_case_to_cycle(session: requests.Session, cycle_id: str, test_case_id: str) -> bool:
    """Связывает тест-кейс с тест-циклом"""
    url = Config.LINK_API
    
    payload = {
        "type": "TEST_CASE",
        "from": cycle_id,
        "to": test_case_id
    }
    
    response = session.post(url, json=payload)
    
    return response.status_code == 200


# =============================================================================
# ОСНОВНАЯ ЛОГИКА
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Импорт тест-кейсов в TMS для Frontend-тестирования')
    parser.add_argument('--create-cycle', action='store_true', help='Создать тест-цикл')
    parser.add_argument('--username', required=True, help='Логин пользователя')
    parser.add_argument('--password', required=True, help='Пароль пользователя')
    parser.add_argument('--folder', help='UUID папки (если существует)')
    parser.add_argument('--folder-name', help='Название папки: "[UI_NODE] [версия API]"')
    parser.add_argument('--parent-folder', help='ID родительской папки (если папка не существует)')
    parser.add_argument('--cycle-name', help='Название цикла тестов')
    parser.add_argument('file', nargs='?', default='test_cases.md', help='Путь к файлу с тест-кейсами')
    
    args = parser.parse_args()
    
    # Создаем сессию
    session = requests.Session()
    
    # Создаем заголовки для Basic Auth
    auth_str = f"{args.username}:{args.password}"
    encoded_auth = base64.b64encode(auth_str.encode()).decode()
    session.headers.update({
        "Authorization": f"Basic {encoded_auth}",
        "Content-Type": "application/json"
    })
    
    # Получаем структуру папок
    folder_structure = get_folder_structure(session)
    
    # Определяем ID папки
    folder_id = args.folder
    
    if not folder_id and args.folder_name:
        # Ищем папку по имени
        print(f"Поиск папки: {args.folder_name}")
        # Здесь должна быть логика поиска папки в структуре
        # Для упрощения - создаём новую папку
    
    # Парсим тест-кейсы
    test_cases = parse_test_case(args.file)
    print(f"Парсинг завершен. Найдено {len(test_cases)} тест-кейсов")
    
    # Создаем папку, если указана
    if args.folder_name and not folder_id:
        print(f"Создание папки: {args.folder_name}")
        folder_id = create_folder(session, args.folder_name, args.parent_folder)
        if folder_id:
            print(f"Папка создана: {folder_id}")
        else:
            print("Ошибка при создании папки")
            return
    
    # Создаем тест-кейсы
    created_tcs = []
    for tc in test_cases:
        payload = create_test_case_payload(tc, folder_id)
        tc_id = create_test_case(session, payload)
        if tc_id:
            created_tcs.append({"original_id": tc.id, "tms_id": tc_id})
            print(f"Создан TC: {tc.id} -> {tc_id}")
        else:
            print(f"Ошибка при создании TC: {tc.id}")
    
    # Создаем цикл, если указано
    if args.create_cycle and args.cycle_name and folder_id:
        cycle_id = create_test_cycle(session, args.cycle_name, folder_id)
        if cycle_id:
            print(f"Цикл создан: {cycle_id}")
            
            # Связываем тест-кейсы с циклом
            for tc in created_tcs:
                linked = link_test_case_to_cycle(session, cycle_id, tc["tms_id"])
                if linked:
                    print(f"Связан TC {tc['tms_id']} с циклом {cycle_id}")
    
    # Выводим результат
    print(f"\nИтого: {len(created_tcs)} из {len(test_cases)} тест-кейсов создано")


if __name__ == "__main__":
    main()
