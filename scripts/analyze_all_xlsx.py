#!/usr/bin/env python3
"""
Анализ всех XLSX файлов тест-кейсов в папке vcs-konwledge-qa
"""

import os
import re
import html
import zipfile
from collections import defaultdict
import json

def parse_xlsx_file(file_path):
    """Парсинг одного XLSX файла"""
    test_cases = []
    try:
        with zipfile.ZipFile(file_path, 'r') as zf:
            with zf.open('xl/worksheets/sheet1.xml') as f:
                content = f.read().decode('utf-8')
            
            rows = re.findall(r'<row r="(\d+)">(.*?)</row>', content, re.DOTALL)
        
        current_tc = None
        for row_num, row_content in rows[1:]:
            texts = re.findall(r'<is><t>([^<]*)</t></is>', row_content)
            num_fields = len(texts)
            
            unit = texts[0] if num_fields > 0 else ""
            summary = texts[1] if num_fields > 1 else ""
            desc = texts[2] if num_fields > 2 else ""
            priority = texts[11] if num_fields > 11 else ""
            test_step = texts[12] if num_fields > 12 else ""
            step_desc = texts[14] if num_fields > 14 else ""
            step_result = texts[16] if num_fields > 16 else ""
            folder = texts[35] if num_fields > 35 else ""
            status = texts[24] if num_fields > 24 else ""
            test_level = texts[42] if num_fields > 42 else ""
            
            if num_fields >= 46 and unit and desc and test_step == "1":
                if current_tc:
                    test_cases.append(current_tc)
                current_tc = {
                    'unit': unit,
                    'summary': summary,
                    'description': desc,
                    'priority': priority.strip() if priority else "(пусто)",
                    'folder': folder.strip() if folder else "(пусто)",
                    'status': status.strip() if status else "(пусто)",
                    'test_level': test_level.strip() if test_level else "(пусто)",
                    'steps': []
                }
                if step_desc.strip() or step_result.strip():
                    current_tc['steps'].append({
                        'step': 1,
                        'description': html.unescape(step_desc.strip()),
                        'result': html.unescape(step_result.strip())
                    })
            
            elif current_tc and num_fields <= 17 and test_step and test_step.isdigit() and int(test_step) > 1:
                if step_desc.strip() or step_result.strip():
                    current_tc['steps'].append({
                        'step': int(test_step),
                        'description': html.unescape(step_desc.strip()),
                        'result': html.unescape(step_result.strip())
                    })
        
        if current_tc:
            test_cases.append(current_tc)
    except Exception as e:
        print(f"Ошибка в {file_path}: {e}")
    
    return test_cases

def analyze_patterns(test_cases):
    """Анализ паттернов шагов и результатов"""
    step_patterns = defaultdict(int)
    result_patterns = defaultdict(int)
    
    for tc in test_cases:
        for step in tc['steps']:
            desc = step['description'].lower()
            result = step['result'].lower()
            
            # Паттерны шагов
            if 'авторизац' in desc:
                step_patterns['авторизация'] += 1
            elif 'перейти' in desc or 'открыть' in desc or 'перейти к' in desc:
                step_patterns['навигация'] += 1
            elif 'нажать' in desc or 'клик' in desc or 'выбрать' in desc or 'выпад' in desc or 'список' in desc:
                step_patterns['нажатие/выбор'] += 1
            elif 'заполнить' in desc or 'поле' in desc or 'ввести' in desc:
                step_patterns['заполнение формы'] += 1
            elif 'сохранить' in desc or 'создать' in desc or 'удалить' in desc or 'изменить' in desc:
                step_patterns['операция CRUD'] += 1
            elif 'отображается' in desc or 'проверить' in desc:
                step_patterns['проверка отображения'] += 1
            
            # Паттерны результатов
            if 'отображается' in result or 'открывается' in result or 'открылась' in result:
                result_patterns['отображение элемента'] += 1
            elif 'успешно' in result or 'создан' in result or 'удален' in result or 'сохранен' in result:
                result_patterns['успешная операция'] += 1
            elif 'ошибка' in result or 'невалид' in result or 'предупреждение' in result or 'не выводится' in result:
                result_patterns['проверка ошибки/валидация'] += 1
            elif 'сообщение' in result or 'toast' in result or 'выводится' in result:
                result_patterns['уведомление'] += 1
    
    return step_patterns, result_patterns

def main():
    folder = '/home/sidorov.d.s@sbertech.ru/Development/giga/skills-functional-testing/vcs-konwledge-qa'
    all_test_cases = []
    
    # Поиск всех XLSX файлов
    xlsx_files = [f for f in os.listdir(folder) if f.endswith('.xlsx') and f.startswith('export_test_cases')]
    print(f"Найдено {len(xlsx_files)} XLSX файлов")
    
    # Парсинг всех файлов
    for xlsx_file in sorted(xlsx_files):
        file_path = os.path.join(folder, xlsx_file)
        print(f"Обработка: {xlsx_file}")
        tcs = parse_xlsx_file(file_path)
        all_test_cases.extend(tcs)
    
    print(f"\nВсего тест-кейсов: {len(all_test_cases)}")
    
    # Статистика
    priorities = defaultdict(int)
    statuses = defaultdict(int)
    levels = defaultdict(int)
    step_counts = defaultdict(int)
    
    for tc in all_test_cases:
        priorities[tc['priority']] += 1
        statuses[tc['status']] += 1
        levels[tc['test_level']] += 1
        step_counts[len(tc['steps'])] += 1
    
    folders = defaultdict(list)
    for tc in all_test_cases:
        folders[tc['folder']].append(tc)
    
    # Анализ паттернов
    step_patterns, result_patterns = analyze_patterns(all_test_cases)
    
    # Вывод статистики
    print("\n" + "="*80)
    print("СТАТИСТИКА")
    print("="*80)
    
    print("\nРаспределение по приоритетам:")
    for p, count in sorted(priorities.items()):
        print(f"  {p:30}: {count}")
    
    print("\nРаспределение по статусам:")
    for s, count in sorted(statuses.items()):
        print(f"  {s:30}: {count}")
    
    print("\nРаспределение по уровням:")
    for l, count in sorted(levels.items()):
        print(f"  {l:30}: {count}")
    
    print("\nРаспределение по количеству шагов:")
    for steps, count in sorted(step_counts.items()):
        bar = "#" * min(count, 50)
        print(f"  {steps:2} шагов: {count:4} TC  {bar}")
    
    print("\nТоп-10 папок:")
    for folder_name, tcs in sorted(folders.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {folder_name[:60]}: {len(tcs)} кейсов")
    
    print("\nПаттерны шагов:")
    for pattern, count in sorted(step_patterns.items(), key=lambda x: x[1], reverse=True):
        print(f"  {pattern:30}: {count}")
    
    print("\nПаттерны результатов:")
    for pattern, count in sorted(result_patterns.items(), key=lambda x: x[1], reverse=True):
        print(f"  {pattern:30}: {count}")
    
    # Сохранение данных
    output = {
        'total': len(all_test_cases),
        'priorities': dict(priorities),
        'statuses': dict(statuses),
        'levels': dict(levels),
        'step_counts': {str(k): v for k, v in step_counts.items()},
        'step_patterns': dict(step_patterns),
        'result_patterns': dict(result_patterns),
        'folders': {k: len(v) for k, v in folders.items()},
        'top_folders': dict(sorted(folders.items(), key=lambda x: len(x[1]), reverse=True)[:20])
    }
    
    with open('/home/sidorov.d.s@sbertech.ru/Development/giga/skills-functional-testing/vcs-konwledge-qa/xlsx_analysis.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nДанные сохранены в xlsx_analysis.json")

if __name__ == '__main__':
    main()
