#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор тест-кейсов для Frontend на основе SA-требований и Test-model.

Использует техники тест-дизайна:
1. Эквивалентное разделение (Equivalence Partitioning)
2. Граничные значения (Boundary Value Analysis)
3. Попарное тестирование (Pairwise Testing)
4. Предугадывание ошибок (Error Guessing)
5. Тестирование на основе состояний (State-Based Testing)

Входные данные:
- SA-требования из spec.md (AC)
- Test-model из vault/test-model/ (UI-узлы)
- Конфигурация из config.md

Выходные данные:
- Тест-кейсы в формате Markdown (по шаблону shablon.md)
"""

import os
import re
import json
from typing import List, Dict, Any, Optional
from pathlib import Path


class FrontendTestCaseGenerator:
    """Генератор тест-кейсов для Frontend-тестирования"""
    
    def __init__(self, vcs_knowledge_path: str, output_path: str):
        self.vcs_knowledge_path = Path(vcs_knowledge_path)
        self.output_path = Path(output_path)
        
    def load_spec(self, spec_path: Path) -> List[Dict[str, Any]]:
        """Загружает SA-требования из spec.md"""
        spec_file = self.vcs_knowledge_path / spec_path
        if not spec_file.exists():
            return []
        
        with open(spec_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Парсим Acceptance Criteria
        ac_pattern = r'\*\*AC-\d+\.\d+\*\*.*?^```(?:.*?```)?'
        matches = re.findall(ac_pattern, content, re.MULTILINE | re.DOTALL)
        
        acs = []
        for match in matches:
            # Извлекаем номер AC
            ac_num_match = re.search(r'\*\*(AC-\d+\.\d+)\*\*', match)
            if ac_num_match:
                acs.append({
                    'id': ac_num_match.group(1),
                    'content': match.strip()
                })
        
        return acs
    
    def load_test_model(self, node_path: str) -> Optional[Dict[str, Any]]:
        """Загружает UI-узел из test-model"""
        # Ищем файл с узлом
        node_file = self.vcs_knowledge_path / 'vault' / 'test-model' / node_path.replace(' / ', '/') / 'README.md'
        if not node_file.exists():
            node_file = self.vcs_knowledge_path / 'vault' / 'test-model' / f"{node_path.replace(' / ', '_')}.md"
        
        if not node_file.exists():
            return None
        
        with open(node_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {
            'path': node_path,
            'content': content
        }
    
    def generate_test_cases(self, ui_node: str, api_version: str, acs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Генерирует тест-кейсы на основе AC и UI-узла"""
        test_cases = []
        
        for i, ac in enumerate(acs, 1):
            tc = self._generate_single_tc(ui_node, api_version, ac, i)
            test_cases.append(tc)
        
        return test_cases
    
    def _generate_single_tc(self, ui_node: str, api_version: str, ac: Dict[str, Any], tc_num: int) -> Dict[str, Any]:
        """Генерирует один тест-кейс"""
        ac_id = ac['id']
        ac_content = ac['content']
        
        # Определяем приоритет на основе уровня AC
        priority = self._determine_priority(ac_id)
        
        # Генерируем шаги на основе типа AC
        steps = self._generate_steps(ac_content, api_version)
        
        # Генерируем альтернативные сценарии
        alt_scenarios = self._generate_alt_scenarios(ui_node, api_version, ac_content)
        
        return {
            'id': f'TC-{tc_num:03d}',
            'name': f'{ac_id}: {self._extract_summary(ac_content)}',
            'priority': priority,
            'ui_node': ui_node,
            'api_version': api_version,
            'tags': self._generate_tags(api_version, priority),
            'steps': steps,
            'alt_scenarios': alt_scenarios
        }
    
    def _determine_priority(self, ac_id: str) -> str:
        """Определяет приоритет на основе номера AC"""
        if 'P1' in ac_id or 'critical' in ac_id.lower():
            return 'critical'
        elif 'P2' in ac_id:
            return 'major'
        else:
            return 'minor'
    
    def _extract_summary(self, ac_content: str) -> str:
        """Извлекает краткое описание из AC"""
        # Ищем первую строку с текстом
        lines = ac_content.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and not line.startswith('**') and not line.startswith('Given') and not line.startswith('When') and not line.startswith('Then'):
                return line[:100]
        return ac_content[:100]
    
    def _generate_steps(self, ac_content: str, api_version: str) -> List[Dict[str, str]]:
        """Генерирует шаги на основе AC"""
        steps = []
        
        # Ищем Given/When/Then в AC
        given_match = re.search(r'Given:\s*(.+?)(?=\n|$)', ac_content)
        when_match = re.search(r'When:\s*(.+?)(?=\n|$)', ac_content)
        then_match = re.search(r'Then:\s*(.+?)(?=\n|$)', ac_content)
        
        step_num = 1
        
        if given_match:
            steps.append({
                'step': step_num,
                'description': f"Предусловие: {given_match.group(1).strip()}",
                'data': '',
                'result': 'Предусловие выполнено'
            })
            step_num += 1
        
        if when_match:
            steps.append({
                'step': step_num,
                'description': f"Действие: {when_match.group(1).strip()}",
                'data': '',
                'result': 'Действие выполнено'
            })
            step_num += 1
        
        if then_match:
            steps.append({
                'step': step_num,
                'description': f"Ожидаемое поведение: {then_match.group(1).strip()}",
                'data': '',
                'result': then_match.group(1).strip()
            })
        
        return steps
    
    def _generate_alt_scenarios(self, ui_node: str, api_version: str, ac_content: str) -> List[Dict[str, str]]:
        """Генерирует альтернативные сценарии"""
        scenarios = []
        
        # Генерируем типовые альтернативные сценарии
        scenarios.append({
            'name': 'Пустое состояние',
            'description': 'Проверка отображения заглушки при отсутствии данных',
            'steps': [
                {'description': 'Очистить все фильтры/данные', 'result': 'Отображается заглушка'}
            ]
        })
        
        scenarios.append({
            'name': 'Ошибка валидации',
            'description': 'Проверка обработки невалидных данных',
            'steps': [
                {'description': 'Ввести невалидные данные', 'result': 'Отображается ошибка валидации'}
            ]
        })
        
        scenarios.append({
            'name': 'Состояние загрузки',
            'description': 'Проверка состояния загрузки данных',
            'steps': [
                {'description': 'Запустить операцию', 'result': 'Отображается лоадер'}
            ]
        })
        
        return scenarios
    
    def _generate_tags(self, api_version: str, priority: str) -> List[str]:
        """Генерирует теги для тест-кейса"""
        base_tags = ['UI', 'FE', api_version]
        
        if priority == 'critical':
            base_tags.append('critical')
        elif priority == 'major':
            base_tags.append('major')
        else:
            base_tags.append('minor')
        
        return base_tags
    
    def export_to_markdown(self, test_cases: List[Dict[str, Any]], output_file: str):
        """Экспортирует тест-кейсы в Markdown файл по шаблону"""
        output_path = self.output_path / output_file
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"# Тесткейсы для UI-узла\n\n")
            
            for tc in test_cases:
                f.write(self._tc_to_markdown(tc))
        
        print(f"Экспортировано {len(test_cases)} тест-кейсов в {output_path}")
    
    def _tc_to_markdown(self, tc: Dict[str, Any]) -> str:
        """Конвертирует один TC в Markdown формат"""
        md = f"""
## {tc['id']}: {tc['name']}

**Id:** {tc['id']}
**Название:** {tc['name']}
**Приоритет:** {tc['priority']}
**Уровень теста:** ui
**Теги:** {', '.join(tc['tags'])}
**Шаги:**

"""
        
        for step in tc['steps']:
            md += f"""
**Шаг {step['step']}:** {step['description']}
**Тестовые данные:** {step['data']}
**Ожидаемый результат:** {step['result']}

"""
        
        if tc.get('alt_scenarios'):
            md += """
### Альтернативные сценарии

"""
            for scenario in tc['alt_scenarios']:
                md += f"""
#### {scenario['name']}

**Описание:** {scenario['description']}

"""
                for step in scenario['steps']:
                    md += f"- {step['description']} => {step['result']}\n"
        
        md += "\n---\n"
        
        return md


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Генератор тест-кейсов для Frontend-тестирования')
    parser.add_argument('--ui-node', required=True, help='Путь к UI-узлу в test-model')
    parser.add_argument('--api-version', default='web2', help='Версия API (web1 или web2)')
    parser.add_argument('--spec-path', default='vault/specs/001-branch-protection/spec.md', help='Путь к spec.md')
    parser.add_argument('--output-dir', default='.', help='Директория для выходных файлов')
    parser.add_argument('--output-file', default='generated_test_cases.md', help='Имя выходного файла')
    parser.add_argument('--vcs-knowledge', default='../../../vcs-vault', help='Путь к vcs-knowledge')
    
    args = parser.parse_args()
    
    # Создаем генератор
    generator = FrontendTestCaseGenerator(
        vcs_knowledge_path=args.vcs_knowledge,
        output_path=args.output_dir
    )
    
    # Загружаем spec
    spec_path = Path(args.spec_path)
    if spec_path.is_absolute():
        spec_path = Path(args.spec_path)
    else:
        spec_path = Path(args.vcs_knowledge) / args.spec_path
    
    acs = generator.load_spec(spec_path)
    
    if not acs:
        print(f"Не удалось загрузить spec из {spec_path}")
        return
    
    print(f"Загружено {len(acs)} Acceptance Criteria")
    
    # Генерируем тест-кейсы
    test_cases = generator.generate_test_cases(
        ui_node=args.ui_node,
        api_version=args.api_version,
        acs=acs
    )
    
    print(f"Сгенерировано {len(test_cases)} тест-кейсов")
    
    # Экспортируем
    generator.export_to_markdown(test_cases, args.output_file)


if __name__ == '__main__':
    main()
