import { Routes } from '@angular/router';

import { AppShellComponent } from '@shared/layout/app-shell/app-shell.component';
import { AuthPage } from './pages/auth/auth.page';

export const routes: Routes = [
  {
    //TODO: смотрим лейауты по актуальному дизайну
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage),
        title: 'Feelo · Главная',
      },
      {
        path: 'schedule',
        loadComponent: () => import('./pages/schedule/schedule.page').then((m) => m.SchedulePage),
        title: 'Feelo · Расписание',
      },
      {
        path: 'wellbeing',
        loadComponent: () =>
          import('./pages/wellbeing/wellbeing.page').then((m) => m.WellbeingPage),
        title: 'Feelo · Состояние',
      },
      {
        path: 'statistics',
        loadComponent: () =>
          import('./pages/statistics/statistics.page').then((m) => m.StatisticsPage),
        title: 'Feelo · Статистика',
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
        title: 'Feelo · Профиль',
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
        title: 'Feelo · Настройки',
      },
    ],
  },
  {
    path: 'auth',
    component: AuthPage,
    title: 'Feelo · Вход',
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage),
    title: 'Feelo · Онбординг',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
