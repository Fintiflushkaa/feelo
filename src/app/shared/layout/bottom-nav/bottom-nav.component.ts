import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-bottom-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss',
})
export class BottomNavComponent {
  readonly items: NavItem[] = [
    { label: 'Задачи', route: '/schedule' },
    { label: 'Ритм', route: '/wellbeing' },
    { label: 'Главная', route: '/home' },
    { label: 'Статистика', route: '/statistics' },
    { label: 'Настройки', route: '/settings' },
  ];
}
