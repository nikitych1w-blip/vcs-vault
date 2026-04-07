
| Задача                                          | Фильтр TQL                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Поиск по релизу с исключением статуса Cancelled | space = "VCS" and fix_version = "9.6.0" AND workflow_status NOT IN("CNCLLD_sGZCjxXGNmqTu") |
| Все задачи в статусе QA                         | space = "VCS" AND workflow_status IN("Q_ymlStTGiWDtKMqTySr")                               |
| Все задачи в "in review"                        | space = "VCS" AND workflow_status IN("in_review")                                          |
|                                                 |                                                                                            |

