#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для полного цикла импорта тест кейсов в TMS систему через API.
Автоматизирует этапы:
1. Создание папки для тест-кейсов
2. Импорт тест-кейсов из markdown файла
3. Создание тест-цикла
4. Связывание тест-цикла с тест-кейсами

Поддерживаемые форматы:
1. Формат test_cases_PR_members.md:
   ## vcs-1-ep-001
   **Id:** vcs-1-ep-001
   **Название:** PATCH /repos/... — Успешное обновление
   **Приоритет:** major
   **Уровень теста:** api
   **Теги:** api, v3, members
   **Шаги:**
   **Шаг 1:** Описание
   **Тестовые данные:** value
   **Ожидаемый результат:** result

2. Формат с полями summary:, priority:, test_level: и т.д.
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
from functools import lru_cache

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
    FOLDER_UUID: str = ""
    DEFAULT_FILES: Tuple[str, ...] = ("test_cases_PR_members.md", "shablon.md")

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

@lru_cache(maxsize=128)
def create_formatted_text(text: str, element_id: str) -> str:
    """Создает JSON-структуру для formattedText с кэшированием"""
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
            "formattedText": create_formatted_text(desc, f"step-{step_num}"),
            "plainText": desc
        },
        "stepData": {
            "formattedText": create_formatted_text(data, f"step-{step_num}-data"),
            "plainText": data
        },
        "stepResult": {
            "formattedText": create_formatted_text(result, f"step-{step_num}-result"),
            "plainText": result
        },
        "callToTestId": None,
        "stepNumber": step_num,
        "stepType": "step_by_step",
        "files": None,
        "deleted": False,
        "stepFiles": []
    }


def extract_field(text: str, field_name: str, use_bold: bool = False) -> Optional[str]:
    """Извлекает значение поля из текста."""
    pattern = rf'\*\*{field_name}:\*\*\s*(.+?)(?:\n|$)' if use_bold else rf'{field_name}:\s*(.+?)(?:\n|$)'
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else None


def normalize_priority(priority: Optional[str]) -> str:
    """Нормализует значение приоритета"""
    if not priority:
        return "minor"
    return PRIORITY_MAP.get(priority.lower().strip(), "major")


def normalize_test_level(level: Optional[str]) -> str:
    """Нормализует значение уровня теста"""
    if not level:
        return "other_level"
    return TEST_LEVEL_MAP.get(level.lower().strip(), "api")


def parse_tags(tags: Optional[str]) -> Optional[List[str]]:
    """Парсит теги в список"""
    if not tags:
        return None
    return [t.strip() for t in re.split(r'[,\s]+', tags) if t.strip()]


def parse_test_case(block: str, space: str = "VCS") -> Optional[Dict[str, Any]]:
    """Парсит блок тест кейса и возвращает структурированные данные.
    
    Поддерживает два формата:
    1. Формат test_cases_PR_members.md с **Id:**, **Название:**, **Приоритет:** и т.д.
    2. Формат с полями summary:, priority:, test_level: и т.д.
    """
    
    # Определяем формат блока
    is_new_format = '**Id:**' in block or '**Название:**' in block
    
    if is_new_format:
        return parse_test_case_new_format(block, space)
    else:
        return parse_test_case_old_format(block, space)


def parse_test_case_new_format(block: str, space: str = "VCS") -> Optional[Dict[str, Any]]:
    """Парсит тест кейс в формате test_cases_PR_members.md"""
    
    summary = extract_field(block, 'Название', use_bold=True)
    if not summary:
        return None
    
    priority = extract_field(block, 'Приоритет', use_bold=True)
    test_level = extract_field(block, 'Уровень теста', use_bold=True)
    tags = extract_field(block, 'Теги', use_bold=True)
    
    steps = _parse_steps_new_format(block, space)
    
    return {
        "summary": summary,
        "priority": normalize_priority(priority),
        "test_level": normalize_test_level(test_level),
        "test_type": "ft_type",
        "automated": "not",
        "type_of_testing": "new",
        "label": parse_tags(tags),
        "pmi": "not",
        "space": space,
        "tenant": "default",
        "test_case_status": "relevant",
        "steps": steps
    }


def _parse_steps_new_format(block: str, space: str) -> List[Dict[str, Any]]:
    """Парсит шаги в формате shablon.md"""
    steps = []
    lines = block.split('\n')
    current_step_num: Optional[int] = None
    current_desc, current_data, current_result = [], [], []
    in_code_block = False
    code_content = []
    
    for line in lines:
        if line.strip().startswith('```'):
            if in_code_block:
                code_text = '\n'.join(code_content)
                if current_step_num is not None and not current_data and not current_result:
                    current_data.append(code_text)
                code_content = []
            else:
                in_code_block = True
            continue
        
        if in_code_block:
            code_content.append(line)
            continue
        
        step_match = re.match(r'\*\*Шаг\s+(\d+):\*\*\s*(.*)', line, re.IGNORECASE)
        if step_match:
            if current_step_num is not None:
                steps.append(_save_step(current_step_num, current_desc, current_data, current_result, space))
            
            current_step_num = int(step_match.group(1))
            current_desc = [step_match.group(2).strip()] if step_match.group(2).strip() else []
            current_data, current_result = [], []
            continue
        
        if current_step_num is not None:
            td_match = re.match(r'\*\*Тестовые данные:\*\*\s*(.*)', line, re.IGNORECASE)
            if td_match:
                if td_match.group(1):
                    current_data.append(td_match.group(1).strip())
                continue
            
            exp_match = re.match(r'\*\*Ожидаемый результат:\*\*\s*(.*)', line, re.IGNORECASE)
            if exp_match:
                if exp_match.group(1):
                    current_result.append(exp_match.group(1).strip())
                continue
            
            if current_result:
                current_result.append(line.strip())
            elif current_data:
                current_data.append(line.strip())
            elif current_desc:
                current_desc.append(line.strip())
    
    if current_step_num is not None:
        steps.append(_save_step(current_step_num, current_desc, current_data, current_result, space))
    
    return steps


def _save_step(step_num: int, desc: List[str], data: List[str], result: List[str], space: str) -> Dict[str, Any]:
    """Сохраняет шаг"""
    step_desc = ' '.join(desc).strip()
    step_data = ' '.join(data).strip() if data else step_desc
    step_result = ' '.join(result).strip() if result else "Операция выполнена"
    return create_step_dict(step_num, step_desc, step_data, step_result, space)


def parse_test_case_old_format(block: str, space: str = "VCS") -> Optional[Dict[str, Any]]:
    """Парсит тест кейс в старом формате с полями summary:, priority: и т.д."""
    
    summary = extract_field(block, 'summary')
    if not summary:
        return None
    
    steps = _parse_steps_old_format(block, space)
    
    label_str = extract_field(block, 'label')
    label_list = None
    if label_str:
        try:
            label_list = json.loads(label_str.replace('"', '"'))
        except:
            label_list = [label_str]
    
    return {
        "summary": summary,
        "priority": normalize_priority(extract_field(block, 'priority')),
        "test_level": normalize_test_level(extract_field(block, 'test_level')),
        "automated": (extract_field(block, 'automated') or "not").lower(),
        "type_of_testing": (extract_field(block, 'type_of_testing') or "new").lower(),
        "label": label_list,
        "pmi": (extract_field(block, 'pmi') or "not").lower(),
        "space": extract_field(block, 'space') or space,
        "tenant": extract_field(block, 'tenant') or "default",
        "test_case_status": (extract_field(block, 'test_case_status') or "draft").lower(),
        "steps": steps
    }


def _parse_steps_old_format(block: str, space: str) -> List[Dict[str, Any]]:
    """Парсит шаги в старом формате"""
    steps = []
    step_pattern = r'шаг\s+(\d+):\s*(.+?)(?=\nТестовые данные:|\nожидаемый результат:|\n\s*шаг\s+\d+:|\Z)'
    test_data_pattern = r'Тестовые данные:\s*(.+?)(?=\nожидаемый результат:|\n\s*шаг\s+\д+:|\Z)'
    expected_pattern = r'ожидаемый результат:\s*(.+?)(?=\n\s*шаг\s+\д+:|\n\s*\{|\Z)'
    
    step_matches = list(re.finditer(step_pattern, block, re.IGNORECASE | re.DOTALL))
    
    for i, step_match in enumerate(step_matches, 1):
        step_num = step_match.group(1)
        step_desc = step_match.group(2).strip()
        
        start_pos = step_match.end()
        end_pos = step_matches[i].start() if i < len(step_matches) else len(block)
        step_block = block[start_pos:end_pos]
        
        test_data = ""
        td_match = re.search(test_data_pattern, step_block, re.IGNORECASE | re.DOTALL)
        if td_match:
            test_data = re.sub(r'\s*```\s*$', '', td_match.group(1).strip())
        
        exp_match = re.search(expected_pattern, step_block, re.IGNORECASE | re.DOTALL)
        step_result = "Операция выполнена"
        if exp_match:
            step_result = re.sub(r'\s*```\s*$', '', exp_match.group(1).strip())
        
        steps.append({
            "code": None,
            "stepDescription": {"formattedText": create_formatted_text(step_desc, f"step-{step_num}"), "plainText": step_desc},
            "stepData": {"formattedText": create_formatted_text(test_data, f"step-{step_num}-data"), "plainText": test_data if test_data else step_desc},
            "stepResult": {"formattedText": create_formatted_text(step_result, f"step-{step_num}-result"), "plainText": step_result},
            "callToTestId": None,
            "stepNumber": i,
            "stepType": "step_by_step",
            "files": None,
            "deleted": False,
            "stepFiles": []
        })
    
    if not steps:
        steps = _parse_steps_alternative(block, space)
    
    return steps


def _parse_steps_alternative(block: str, space: str) -> List[Dict[str, Any]]:
    """Альтернативный парсинг шагов"""
    steps = []
    lines = block.split('\n')
    current_step_num: Optional[int] = None
    current_desc, current_data, current_result = [], [], []
    
    for line in lines:
        if re.match(r'шаг\s+\d+:', line, re.IGNORECASE):
            if current_step_num is not None:
                steps.append(_save_step(len(steps) + 1, current_desc, current_data, current_result, space))
            
            current_step_num = int(re.search(r'шаг\s+(\d+):', line, re.IGNORECASE).group(1))
            current_desc = [re.sub(r'шаг\s+\d+:', '', line, flags=re.IGNORECASE).strip()]
            current_data, current_result = [], []
            
        elif line.startswith('Тестовые данные:'):
            current_data.append(line.replace('Тестовые данные:', '').strip())
        elif line.startswith('ожидаемый результат:'):
            current_result.append(line.replace('ожидаемый результат:', '').strip())
        elif current_step_num is not None:
            if current_data and not current_result:
                current_data.append(line.strip())
            elif current_result:
                current_result.append(line.strip())
    
    if current_step_num is not None:
        steps.append(_save_step(len(steps) + 1, current_desc, current_data, current_result, space))
    
    return steps


def parse_markdown_file(filepath: str, space: str = "VCS") -> List[Dict[str, Any]]:
    """Парсит markdown файл и извлекает все тест кейсы.
    
    Поддерживает два формата:
    1. Формат test_cases_PR_members.md с ## заголовками и **полями**
    2. Формат с блоками кода содержащими summary:, priority: и т.д.
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    test_cases = []
    
    # Пробуем определить формат файла
    if '**Id:**' in content or '**Название:**' in content:
        # Формат test_cases_PR_members.md
        # Разделяем по заголовкам ##
        sections = re.split(r'\n(?=##\s+\S+)', content)
        
        for section in sections:
            section = section.strip()
            if not section:
                continue
            
            # Проверяем, есть ли в секции тест кейс
            if '**Id:**' in section and '**Название:**' in section:
                test_case = parse_test_case(section, space)
                if test_case:
                    test_cases.append(test_case)
    else:
        # Старый формат с блоками кода
        code_blocks = re.findall(r'```\s*\n(.*?)\n\s*```', content, re.DOTALL)
        
        for block in code_blocks:
            if 'summary:' in block.lower():
                test_case = parse_test_case(block, space)
                if test_case:
                    test_cases.append(test_case)
    
    return test_cases


def create_tms_payload(test_case: Dict[str, Any], folder_uuid: str = Config.FOLDER_UUID) -> Dict[str, Any]:
    """Создает payload для API TMS"""
    steps_payload = {"testStepList": test_case["steps"]}
    
    attributes = {
        "space": test_case["space"],
        "tenant": test_case["tenant"],
        "automated": test_case["automated"],
        "folder": folder_uuid,
        "label": test_case["label"],
        "priority": test_case["priority"],
        "test_case_status": test_case["test_case_status"],
        "test_level": test_case["test_level"],
        "pmi": test_case["pmi"],
        "test_type": test_case.get("test_type", "smoke_type"),
        "type_of_testing": test_case["type_of_testing"],
        "test_step": steps_payload,
        **DEFAULT_ATTRIBUTES
    }
    
    return {
        "space": test_case["space"],
        "suit": test_case.get("suit", "test_case"),
        "description": test_case.get("description"),
        "summary": test_case["summary"],
        "code": None,
        "draftsInfo": [],
        "links": [],
        "attributes": attributes
    }


def import_test_case(payload: Dict[str, Any], auth_header: str, api_url: str) -> Dict[str, Any]:
    """Отправляет тест кейс в TMS систему"""
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=60, verify=False)
        
        # Пытаемся распарсить ответ, но не падаем если не получилось
        try:
            response_data = response.json() if response.text else None
        except json.JSONDecodeError:
            response_data = {"raw_response": response.text[:500] if response.text else "Empty response"}
        
        return {
            "status_code": response.status_code,
            "response": response_data,
            "success": response.status_code in [200, 201],
            "raw_text": response.text[:200] if not response_data else None
        }
    except Exception as e:
        return {
            "status_code": 0,
            "error": str(e),
            "success": False
        }


# =============================================================================
# ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ПАПКАМИ И ТЕСТ-ЦИКЛАМИ
# =============================================================================

def get_auth_header(username: str, password: str) -> str:
    """Создает Basic Auth заголовок"""
    return base64.b64encode(f"{username}:{password}".encode('utf-8')).decode('utf-8')


def get_folder_tree(auth_header: str, base_url: str, space: str = "VCS") -> Dict[str, Any]:
    """Получает дерево папок"""
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json"
    }
    
    url = f"{base_url}/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/folder/root"
    payload = {"type": "TEST_CASE", "spaceId": {"code": space}}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        return {"success": True, "data": response.json()}
    except Exception as e:
        return {"success": False, "error": str(e)}


def create_folder(auth_header: str, base_url: str, folder_name: str, parent_id: str, space: str = "VCS") -> Dict[str, Any]:
    """Создает новую папку"""
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json"
    }
    
    url = f"{base_url}/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/folder/create"
    payload = {
        "name": folder_name,
        "parentId": {"code": parent_id},
        "spaceId": {"code": space}
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        data = response.json()
        return {"success": True, "id": data.get("id", {}).get("code"), "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


def create_test_cycle(auth_header: str, base_url: str, cycle_name: str, space: str = "VCS") -> Dict[str, Any]:
    """Создает новый тест-цикл"""
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json"
    }
    
    url = f"{base_url}/rest/api/unit/v2/test_cycle/create"
    payload = {
        "description": None,
        "suit": "test_cycle",
        "space": space,
        "summary": cycle_name,
        "code": None,
        "draftsInfo": [],
        "links": [],
        "attributes": {
            "space": space,
            "tenant": "default",
            "folder": "VCS_test_cycle",
            "owner": None,
            "plan_date_end": None,
            "plan_date_start": None,
            "test_case_test_type": "new",
            "test_cycle_status": "in_progress",
            "type_of_testing": "new",
            "release_name": "Не задан",
            "cycles_number": "1",
            "iteration_type": None,
            "old_jira_key": None,
            "cycle_automated": None
        }
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        data = response.json()
        return {"success": True, "id": data.get("id"), "data": data}
    except Exception as e:
        return {"success": False, "error": str(e)}


def link_test_cycle_to_cases(auth_header: str, base_url: str, cycle_id: str, test_case_ids: List[str]) -> Dict[str, Any]:
    """Связывает тест-цикл с тест-кейсами"""
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/json"
    }
    
    url = f"{base_url}/extension/plugin/v2/rest/api/swtr_tms_plugin/v1/link"
    payload = {
        "source": cycle_id,
        "destinations": test_case_ids,
        "type": "test_cycle_to_test_case_link"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30, verify=False)
        response.raise_for_status()
        return {"success": True, "data": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}


def find_folder_by_title(folder_tree: Dict, title: str) -> Optional[str]:
    """Рекурсивно ищет папку по названию в дереве папок"""
    if not folder_tree:
        return None
    
    children = folder_tree.get("children", [])
    for child in children:
        if child.get("title") == title:
            return child.get("id", {}).get("code")
        result = find_folder_by_title(child, title)
        if result:
            return result
    return None


# =============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ MAIN
# =============================================================================

def find_input_file(input_file: Optional[str]) -> Optional[str]:
    """Находит файл для импорта"""
    if input_file:
        return input_file if Path(input_file).exists() else None
    
    for f in Config.DEFAULT_FILES:
        if Path(f).exists():
            return f
    return None


def print_summary(test_cases: List[Dict[str, Any]]) -> None:
    """Выводит информацию о найденных тест кейсах"""
    print("\n    Найденные тест кейсы:")
    for i, tc in enumerate(test_cases, 1):
        summary_preview = tc['summary'][:70] + "..." if len(tc['summary']) > 70 else tc['summary']
        print(f"    {i}. {summary_preview} (Приоритет: {tc['priority']}, Шагов: {len(tc['steps'])})")


def print_folder_tree(folder_tree: Dict, indent: int = 0) -> None:
    """Выводит дерево папок"""
    if not folder_tree:
        return
    
    title = folder_tree.get("title", "root")
    key = folder_tree.get("id", {}).get("code", "")[:8]
    print("  " * indent + f"- {title} (ID: {key}...)")
    
    for child in folder_tree.get("children", []):
        print_folder_tree(child, indent + 1)


# =============================================================================
# ОСНОВНАЯ ФУНКЦИЯ
# =============================================================================

def main():
    """Основная функция"""
    parser = argparse.ArgumentParser(
        description='Полный цикл импорта тест кейсов в TMS систему с созданием папки и тест-цикла',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Примеры использования:
  python3 import_tests_to_tms_full.py test_cases_PR_members.md
  python3 import_tests_to_tms_full.py --username user --password pass --folder-name "My Tests" file.md
  python3 import_tests_to_tms_full.py --dry-run --output results.json
  python3 import_tests_to_tms_full.py --folder-id existing_folder_id file.md
        '''
    )
    parser.add_argument('input_file', nargs='?', help='Путь к Markdown файлу с тест кейсами')
    parser.add_argument('--dry-run', action='store_true', help='Режим без отправки в TMS (только парсинг)')
    parser.add_argument('--output', '-o', default='import_results.json', help='Файл для сохранения результатов (по умолчанию: import_results.json)')
    
    parser.add_argument('--username', default=Config.USERNAME, help=f'Имя пользователя')
    parser.add_argument('--password', default=Config.PASSWORD, help=f'Пароль')
    parser.add_argument('--space', default=Config.SPACE, help=f'Пространство имен (по умолчанию: {Config.SPACE})')
    parser.add_argument('--folder', dest='folder_uuid', default=Config.FOLDER_UUID, help=f'UUID существующей папки (если не создавать новую)')
    parser.add_argument('--folder-name', dest='folder_name', help=f'Название новой папки для тест-кейсов (если не указан --folder)')
    parser.add_argument('--parent-folder', dest='parent_folder', default="eebb9ccc-85fd-4ed2-a64c-a0282625e01e", help=f'UUID родительской папки для новой папки (по умолчанию: test papka)')
    parser.add_argument('--api-url', default=Config.TEST_CASE_API, help=f'URL API TMS для тест-кейсов (по умолчанию: {Config.TEST_CASE_API})')
    parser.add_argument('--base-url', default=Config.BASE_URL, help=f'Базовый URL API (по умолчанию: {Config.BASE_URL})')
    parser.add_argument('--create-cycle', action='store_true', help='Создать тест-цикл и связать с тест-кейсами')
    parser.add_argument('--cycle-name', help='Название тест-цикла (по умолчанию: название папки)')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("Полный цикл импорта тест кейсов в TMS систему")
    print("=" * 60)
    
    input_file = find_input_file(args.input_file)
    if not input_file:
        print("\nОшибка: не найден файл с тест кейсами")
        print("Используйте: python import_tests_to_tms_full.py <путь_к_файлу>")
        return
    
    print(f"\n[1] Парсинг тест кейсов из файла {input_file}...")
    test_cases = parse_markdown_file(input_file, args.space)
    print(f"    Найдено тест кейсов: {len(test_cases)}")
    
    if not test_cases:
        print("    Ошибка: не найдено тест кейсов для импорта")
        return
    
    print_summary(test_cases)
    
    if args.dry_run:
        print("\n[DRY RUN] Пропускаем импорт в TMS...")
        return
    
    # Получаем токен авторизации
    print("\n[2] Авторизация...")
    print(f"    Username: {args.username}")
    print(f"    Space: {args.space}")
    print(f"    Base URL: {args.base_url}")
    auth_header = get_auth_header(args.username, args.password)
    print(f"    Basic {auth_header[:20]}...")
    print("    Токен получен")
    
    # Получаем дерево папок
    print("\n[3] Получение дерева папок...")
    folder_result = get_folder_tree(auth_header, args.base_url, args.space)
    if folder_result["success"]:
        print("    Дерево папок получено")
        folder_tree = folder_result["data"]
        print_folder_tree(folder_tree)
    else:
        print(f"    Ошибка получения дерева папок: {folder_result.get('error')}")
        return
    
    # Определяем папку для тест-кейсов
    folder_id = args.folder_uuid
    if not folder_id:
        if args.folder_name:
            # Проверяем, существует ли папка с таким названием
            existing_folder_id = find_folder_by_title(folder_tree, args.folder_name)
            if existing_folder_id:
                print(f"\n[4] Найдена существующая папка '{args.folder_name}' с ID {existing_folder_id}")
                folder_id = existing_folder_id
            else:
                # Создаем новую папку
                print(f"\n[4] Создание новой папки '{args.folder_name}'...")
                create_result = create_folder(auth_header, args.base_url, args.folder_name, args.parent_folder, args.space)
                if create_result["success"]:
                    folder_id = create_result["id"]
                    print(f"    Папка создана с ID: {folder_id}")
                else:
                    print(f"    Ошибка создания папки: {create_result.get('error')}")
                    return
        else:
            print("\nОшибка: не указана папка (--folder) или название новой папки (--folder-name)")
            return
    else:
        print(f"\n[4] Используем существующую папку с ID: {folder_id}")
    
    # Импортируем тест кейсы
    print("\n[5] Импорт тест кейсов в TMS...")
    success_count = 0
    error_count = 0
    results = []
    test_case_ids = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n    [{i}/{len(test_cases)}] Импорт: {test_case['summary'][:60]}...")
        
        payload = create_tms_payload(test_case, folder_id)
        result = import_test_case(payload, auth_header, args.api_url)
        
        result_info = {
            "id": i,
            "summary": test_case['summary'],
            "success": result["success"],
            "status_code": result.get("status_code"),
            "error": result.get("error"),
            "response": result.get("response")
        }
        results.append(result_info)
        
        if result["success"]:
            print(f"        ✓ Успешно (статус: {result['status_code']})")
            success_count += 1
            # Сохраняем ID тест-кейса
            if result.get("response") and isinstance(result["response"], dict):
                test_case_id = result["response"].get("id")
                if test_case_id:
                    test_case_ids.append(test_case_id)
        else:
            print(f"        ✗ Ошибка: {result.get('error', result.get('response', 'Неизвестная ошибка'))}")
            error_count += 1
    
    # Итоги импорта
    print("\n" + "=" * 60)
    print("ИТОГИ ИМПОРТА ТЕСТ-КЕЙСОВ")
    print("=" * 60)
    print(f"    Всего тест кейсов: {len(test_cases)}")
    print(f"    Успешно импортировано: {success_count}")
    print(f"    Ошибок: {error_count}")
    print("=" * 60)
    
    # Создаем тест-цикл если указано
    cycle_id = None
    if args.create_cycle:
        cycle_name = args.cycle_name if args.cycle_name else args.folder_name
        if not cycle_name:
            cycle_name = f"test_cycle_{len(test_cases)}"
        
        print(f"\n[6] Создание тест-цикла '{cycle_name}'...")
        cycle_result = create_test_cycle(auth_header, args.base_url, cycle_name, args.space)
        if cycle_result["success"]:
            cycle_id = cycle_result["id"]
            print(f"    Тест-цикл создан с ID: {cycle_id}")
            
            # Связываем тест-цикл с тест-кейсами
            print(f"\n[7] Связывание тест-цикла {cycle_id} с {len(test_case_ids)} тест-кейсами...")
            if test_case_ids:
                link_result = link_test_cycle_to_cases(auth_header, args.base_url, cycle_id, test_case_ids)
                if link_result["success"]:
                    print(f"    Тест-цикл успешно связан с тест-кейсами")
                else:
                    print(f"    Ошибка связывания: {link_result.get('error')}")
            else:
                print("    Нет тест-кейсов для связывания")
        else:
            print(f"    Ошибка создания тест-цикла: {cycle_result.get('error')}")
    
    # Сохраняем результаты в JSON файл
    output_file = args.output
    output_data = {
        "summary": {
            "total": len(test_cases),
            "success": success_count,
            "errors": error_count,
            "input_file": input_file,
            "username": args.username,
            "space": args.space,
            "folder_uuid": folder_id,
            "api_url": args.api_url,
            "base_url": args.base_url
        },
        "results": results,
        "test_case_ids": test_case_ids
    }
    
    if cycle_id:
        output_data["test_cycle_id"] = cycle_id
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\nРезультаты сохранены в файл: {output_file}")
    
    # Финальные итоги
    print("\n" + "=" * 60)
    print("ФИНАЛЬНЫЕ ИТОГИ")
    print("=" * 60)
    print(f"    Папка: {folder_id}")
    if cycle_id:
        print(f"    Тест-цикл: {cycle_id}")
    print(f"    Тест-кейсов импортировано: {success_count}")
    print(f"    Тест-кейсов связано с циклом: {len(test_case_ids)}")
    print("=" * 60)


if __name__ == "__main__":
    main()