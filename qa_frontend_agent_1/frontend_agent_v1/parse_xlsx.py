#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для парсинга тест-кейсов из Excel файлов (export from TMS).

Структура строк:
- 46+ полей: начало тест-кейса (unit, summary, description) + шаг 1 (если есть)
- 15-17 полей: шаги 2, 3, 4... без unit (продолжение предыдущего TC)

Поля:
[0] unit - ID тест-кейса
[1] summary - Название
[2] description - Описание TC
[11] priority - Приоритет
[12] test_step - Номер шага (1 для начала TC, 2+ для шагов)
[13] step_type - Тип шага (step_by_step)
[14] step_desc - Описание шага (только в строках 17 полей)
[16] step_result - Ожидаемый результат (только в строках 17 полей)
[24] status - Статус
[35] folder - Путь в TMS
[42] test_level - Уровень теста (UI/API)
"""

import zipfile
import re
import html
import json
from typing import List, Dict, Any
from pathlib import Path
import argparse


def parse_excel_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Парсит тест-кейсы из Excel файла.
    
    Возвращает список тест-кейсов с полями:
    - unit: ID тест-кейса
    - summary: Название
    - description: Описание
    - priority: Приоритет (Critical/Major/Minor/Trivial)
    - folder: Путь в TMS
    - status: Статус
    - test_level: Уровень теста (UI/API)
    - steps: Список шагов с description и result
    """
    
    with zipfile.ZipFile(file_path, 'r') as zf:
        with zf.open('xl/worksheets/sheet1.xml') as f:
            content = f.read().decode('utf-8')
        
        rows = re.findall(r'<row r="(\d+)">(.*?)</row>', content, re.DOTALL)
    
    test_cases = []
    current_tc = None
    
    for row_idx, (row_num, row_content) in enumerate(rows[1:], 2):
        texts = re.findall(r'<is><t>([^<]*)</t></is>', row_content)
        num_fields = len(texts)
        
        # Получаем поля в зависимости от структуры строки
        unit = texts[0] if num_fields > 0 else ""
        summary = texts[1] if num_fields > 1 else ""
        desc = texts[2] if num_fields > 2 else ""
        priority = texts[11] if num_fields > 11 else ""
        test_step = texts[12] if num_fields > 12 else ""
        step_type = texts[13] if num_fields > 13 else ""
        step_desc = texts[14] if num_fields > 14 else ""
        step_result = texts[16] if num_fields > 16 else ""
        folder = texts[35] if num_fields > 35 else ""
        status = texts[24] if num_fields > 24 else ""
        test_level = texts[42] if num_fields > 42 else ""
        
        # Структура: 46+ полей = начало тест-кейса
        # Проверяем, что это новый TC:
        # - есть unit
        # - есть description (или summary)
        # - шаг 1 в поле [12]
        if num_fields >= 46 and unit and (desc.strip() or summary.strip()) and test_step == "1":
            # Сохраняем предыдущий TC если есть
            if current_tc:
                test_cases.append(current_tc)
            
            # Создаем новый TC
            current_tc = {
                'unit': unit,
                'summary': summary,
                'description': desc,
                'priority': priority,
                'folder': folder,
                'status': status,
                'test_level': test_level,
                'steps': []
            }
            
            # Если есть описание шага 1, добавляем его
            if step_desc.strip() or step_result.strip():
                current_tc['steps'].append({
                    'step': 1,
                    'description': html.unescape(step_desc.strip()),
                    'result': html.unescape(step_result.strip())
                })
        
        # Структура: 15/17 полей = шаг тест-кейса (продолжение предыдущего TC)
        # Проверяем, что это шаг (номер шага > 1)
        elif current_tc and num_fields <= 17 and test_step and test_step.isdigit() and int(test_step) > 1:
            # Добавляем шаг только если есть описание или результат
            if step_desc.strip() or step_result.strip():
                current_tc['steps'].append({
                    'step': int(test_step),
                    'description': html.unescape(step_desc.strip()),
                    'result': html.unescape(step_result.strip())
                })
    
    # Не забываем последний TC
    if current_tc:
        test_cases.append(current_tc)
    
    return test_cases


def parse_multiple_files(file_paths: List[str]) -> List[Dict[str, Any]]:
    """Парсит несколько Excel файлов и объединяет результаты."""
    all_test_cases = []
    for file_path in file_paths:
        test_cases = parse_excel_file(file_path)
        all_test_cases.extend(test_cases)
    return all_test_cases


def export_to_json(test_cases: List[Dict[str, Any]], output_path: str):
    """Экспортирует тест-кейсы в JSON файл."""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(test_cases, f, ensure_ascii=False, indent=2)
    print(f"Экспортировано {len(test_cases)} тест-кейсов в {output_path}")


def print_summary(test_cases: List[Dict[str, Any]]):
    """Печатает сводку по тест-кейсам."""
    from collections import defaultdict
    
    priorities = defaultdict(int)
    statuses = defaultdict(int)
    levels = defaultdict(int)
    folders = defaultdict(list)
    total_steps = 0
    
    for tc in test_cases:
        priorities[tc['priority']] += 1
        statuses[tc['status']] += 1
        levels[tc['test_level']] += 1
        if tc['folder'] and tc['folder'] != "[]":
            folders[tc['folder']].append(tc['unit'])
        total_steps += len(tc['steps'])
    
    print(f"\n{'='*60}")
    print("СВОДКА ПО ТЕСТ-КЕЙСАМ")
    print(f"{'='*60}")
    print(f"Всего тест-кейсов: {len(test_cases)}")
    print(f"Всего шагов: {total_steps}")
    print(f"Среднее шагов на TC: {total_steps/len(test_cases):.1f}")
    
    print(f"\nРаспределение по приоритетам:")
    for p, c in sorted(priorities.items()):
        print(f"  {p or '(пусто)'}: {c}")
    
    print(f"\nРаспределение по статусам:")
    for s, c in sorted(statuses.items()):
        print(f"  {s or '(пусто)'}: {c}")
    
    print(f"\nРаспределение по уровням:")
    for l, c in sorted(levels.items()):
        print(f"  {l or '(пусто)'}: {c}")
    
    print(f"\nТоп-10 папок:")
    for folder, tcs in sorted(folders.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {folder}: {len(tcs)} кейсов")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Парсинг тест-кейсов из Excel файлов')
    parser.add_argument('files', nargs='+', help='Пути к Excel файлам')
    parser.add_argument('--output', '-o', help='Путь к выходному JSON файлу')
    parser.add_argument('--summary', '-s', action='store_true', help='Вывести сводку')
    
    args = parser.parse_args()
    
    # Парсим все файлы
    test_cases = parse_multiple_files(args.files)
    
    # Выводим сводку
    if args.summary:
        print_summary(test_cases)
    
    # Экспортируем в JSON
    if args.output:
        export_to_json(test_cases, args.output)
