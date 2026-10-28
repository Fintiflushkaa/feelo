# Feelo

## Cтруктура проекта

```
src/
├── app/
│   │
│   ├── app.config.ts              # providers: provideRouter, provideHttpClient, provideServiceWorker, DI-токены
│   ├── app.routes.ts              # ВСЕ роуты приложения
│   ├── app.ts                     # root component (standalone), <router-outlet>
│   │
│   ├── domain/
│   │   │                          # Бизнес-правила, модели, алгоритмы.
│   │   │
│   │   ├── shared/
│   │   │   ├── clock.ts           # порт Clock { now(): Iso }
│   │   │   ├── result.ts          # Result<T, E> / DomainError
│   │   │   └── time.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── user.model.ts
│   │   │   └── auth.repository.ts         # порт: login(), register(), logout(), getSession()
│   │   │
│   │   ├── profile/
│   │   │   ├── profile.model.ts            # таймзона, предпочтения планирования
│   │   │   └── profile.repository.ts
│   │   │
│   │   ├── sleep/
│   │   │   ├── sleep-schedule.model.ts     # привычное время сна будни/выходные
│   │   │   ├── sleep-log.model.ts          # фактическое засыпание/пробуждение, качество
│   │   │   ├── sleep.rules.ts              # сверка факта с расписанием, отклонения
│   │   │   └── sleep.repository.ts
│   │   │
│   │   ├── chronotype/
│   │   │   ├── chronotype-quiz.model.ts
│   │   │   ├── chronotype.rules.ts         # расчёт типа из ответов опросника
│   │   │   └── chronotype.repository.ts
│   │   │
│   │   ├── wellbeing/
│   │   │   ├── daily-checkin.model.ts      # energy, fatigue, concentration (1..5)
│   │   │   └── wellbeing.repository.ts
│   │   │
│   │   ├── task/
│   │   │   ├── task.model.ts
│   │   │   ├── task.rules.ts               # complete(), canComplete(), overdue()
│   │   │   └── task.repository.ts
│   │   │
│   │   ├── events/
│   │   │   ├── task-event.model.ts
│   │   │   ├── event-factory.ts
│   │   │   └── event.repository.ts
│   │   │
│   │   ├── circadian/
│   │   │   ├── daily-profile.ts            # сборка профиля из sleep+chronotype+events+checkins
│   │   │   ├── smoothing.ts                # blend() приора и наблюдений
│   │   │   └── profile.repository.ts
│   │   │
│   │   ├── recommendation/
│   │   │   ├── recommendation.model.ts
│   │   │   └── recommendation.rules.ts     # подбор времени под категорию задачи
│   │   │
│   │   ├── schedule/
│   │   │   ├── schedule.model.ts           # ScheduleSlot[], день/неделя
│   │   │   ├── schedule-builder.ts         # автораспределение задач по профилю
│   │   │   ├── conflict-detector.ts        # пересечения по времени
│   │   │   └── carry-over.rules.ts         # перенос невыполненных задач
│   │   │
│   │   ├── notification/
│   │   │   ├── notification.model.ts
│   │   │   └── notification.rules.ts       # когда показывать напоминание
│   │   │
│   │   ├── statistics/
│   │   │   ├── task-stats.ts
│   │   │   └── sleep-stats.ts
│   │   │
│   │   └── sync/
│   │       └── sync-operation.model.ts
│   │
│   ├── core/                      # Инфраструктура и адаптеры.
│   │   │                          # Синглтоны. Без бизнес-правил.
│   │   │
│   │   ├── api/
│   │   │   ├── api-client.ts               # обёртка над HttpClient
│   │   │   ├── auth.interceptor.ts         # подстановка токена
│   │   │   └── error.interceptor.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── token-storage.service.ts
│   │   │   ├── http-auth.repository.ts     # implements domain/auth/auth.repository
│   │   │   └── auth.guard.ts                # функциональный canActivate
│   │   │
│   │   ├── storage/
│   │   │   ├── db.ts                        # openDB, схема IndexedDB
│   │   │   ├── migrations.ts
│   │   │   ├── indexeddb-task.repository.ts
│   │   │   ├── indexeddb-event.repository.ts
│   │   │   ├── indexeddb-sleep.repository.ts
│   │   │   └── indexeddb-wellbeing.repository.ts
│   │   │
│   │   ├── sync/
│   │   │   ├── outbox.ts                    # очередь неотправленных операций
│   │   │   ├── sync.service.ts              # дренирует outbox при онлайне, last-write-wins
│   │   │   └── network-status.service.ts    # online/offline сигнал
│   │   │
│   │   ├── clock/
│   │   │   └── system-clock.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── web-push.service.ts
│   │   │   └── notification-scheduler.service.ts
│   │   │
│   │   ├── pwa/
│   │   │   ├── sw-update.service.ts
│   │   │   └── install-prompt.service.ts
│   │   │
│   │   └── tokens.ts                        # InjectionToken'ы для всех портов
│   │
│   ├── features/                  # Бизнес-логика фич: stores + компоненты фичи.
│   │   │                          # НЕ роутится напрямую, подключается в pages.
│   │   │
│   │   ├── auth/
│   │   │   ├── auth.store.ts                # login(), register(), logout(), session signal
│   │   │   └── ui/
│   │   │       └── auth-form/
│   │   │
│   │   ├── onboarding/
│   │   │   ├── onboarding.store.ts          # шаги: сон -> хронотип -> первые задачи
│   │   │   └── ui/
│   │   │       ├── sleep-setup-form/
│   │   │       └── first-tasks-form/
│   │   │
│   │   ├── chronotype/
│   │   │   ├── chronotype.store.ts
│   │   │   └── ui/
│   │   │       ├── quiz-question/
│   │   │       └── quiz-result/
│   │   │
│   │   ├── profile/
│   │   │   ├── profile.store.ts
│   │   │   └── ui/
│   │   │       └── profile-form/
│   │   │
│   │   ├── tasks/
│   │   │   ├── tasks.store.ts
│   │   │   └── ui/
│   │   │       ├── task-item/
│   │   │       ├── task-form/               # переиспользуется в модалке создания и редактировании
│   │   │       └── task-filters/
│   │   │
│   │   ├── schedule/
│   │   │   ├── schedule.store.ts            # текущее расписание, режим день/неделя
│   │   │   └── ui/
│   │   │       ├── timeline/
│   │   │       ├── schedule-slot/
│   │   │       └── conflict-banner/
│   │   │
│   │   ├── circadian/
│   │   │   ├── circadian.store.ts
│   │   │   └── ui/
│   │   │       ├── activity-heatmap/
│   │   │       └── profile-legend/
│   │   │
│   │   ├── recommendation/
│   │   │   ├── recommendation.store.ts
│   │   │   └── ui/
│   │   │       └── recommendation-card/
│   │   │
│   │   ├── wellbeing/
│   │   │   ├── wellbeing.store.ts           # ежедневный чек-ин + история
│   │   │   └── ui/
│   │   │       ├── checkin-form/
│   │   │       └── mood-scale/
│   │   │
│   │   ├── sleep/
│   │   │   ├── sleep.store.ts
│   │   │   └── ui/
│   │   │       ├── sleep-log-form/
│   │   │       └── sleep-history-list/
│   │   │
│   │   ├── statistics/
│   │   │   ├── statistics.store.ts
│   │   │   └── ui/
│   │   │       ├── completion-chart/
│   │   │       └── sleep-trend-chart/
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.store.ts       # настройки напоминаний
│   │   │   └── ui/
│   │   │       └── reminder-settings/
│   │   │
│   │   └── settings/
│   │       └── settings.store.ts            # тема, формат даты, таймзона, планирование
│   │
│   ├── pages/                     # Роутируемые страницы. Тонкие контейнеры.
│   │   │                          # Знают features + core + domain.
│   │   │
│   │   ├── home/
│   │   │   └── home.page.ts                 # сводка: ближайшие задачи + текущий статус профиля
│   │   │
│   │   ├── auth/
│   │   │   └── auth.page.ts                 # login/register тоггл на одной странице
│   │   │
│   │   ├── onboarding/
│   │   │   └── onboarding.page.ts           # визард: сон -> хронотип -> первые задачи
│   │   │
│   │   ├── schedule/
│   │   │   └── schedule.page.ts             # расписание недели/дня
│   │   │
│   │   ├── wellbeing/
│   │   │   └── wellbeing.page.ts            # "состояния пользователя": чек-ин + история
│   │   │
│   │   ├── statistics/
│   │   │   └── statistics.page.ts
│   │   │
│   │   ├── profile/
│   │   │   └── profile.page.ts
│   │   │
│   │   └── settings/
│   │       └── settings.page.ts
│   │
│   └── shared/
│       │
│       ├── ui/                              # презентационные компоненты
│       │   ├── button/
│       │   ├── modal/                       # используется tasks/ui/task-form как содержимое
│       │   ├── badge/
│       │   ├── empty-state/
│       │   ├── offline-banner/              # индикатор "показываю закешированное"
│       │   └── toast/
│       │
│       ├── layout/
│       │   ├── app-shell/
│       │   ├── header/
│       │   └── bottom-nav/
│       │
│       ├── pipes/
│       │   ├── relative-time.pipe.ts
│       │   ├── duration.pipe.ts
│       │   └── demand-label.pipe.ts
│       │
│       ├── directives/
│       │   └── long-press.directive.ts
│       │
│       └── utils/
│
├── assets/
│   ├── icons/
│   └── i18n/
│
├── styles/
│   ├── tokens.css
│   └── global.css
│
├── manifest.webmanifest
├── ngsw-config.json
└── index.html
```

## Запуск проекта

```bash
ng serve
```
