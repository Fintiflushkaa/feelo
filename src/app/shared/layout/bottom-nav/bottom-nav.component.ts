import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  //TODO заменить на актуальные иконки
  readonly items: NavItem[] = [
    {
      label: 'Главная',
      route: '/home',
      icon: `
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      `,
    },
    {
      label: 'Расписание',
      route: '/schedule',
      icon: `
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 2v4M16 2v4" />
      `,
    },
    {
      label: 'Состояние',
      route: '/wellbeing',
      icon: `
        <path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6C19 16.4 12 21 12 21Z" />
      `,
    },
    {
      label: 'Статистика',
      route: '/statistics',
      icon: `
        <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
      `,
    },
  ];
}
