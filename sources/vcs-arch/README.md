# VCS-ARCH

## Описание
Репозиторий предназначен для разработки и хранения архитектурных диаграмм.

Формат диаграмм - PlantUml.

Используемая нотация - C4 https://github.com/plantuml-stdlib/C4-PlantUML/tree/master .


## Структура репозитория

```bash
├── Makefile
├── README.md
└── docs
    └── architecture
        └── c4
            └──4-deployment
                ├── docs   ### Для документации docs.sbt. Упрощенные схемы для прохождения КБ
                │   └── diagram.puml
                ├── pao    ### Диаграммы, отражающие особенности ПАО (целевого заказчика)
                │   └── diagram-extended.puml
                └── images  ### Выгруженные диаграммы в формате png
                    └── image.png
```