import { Component } from '@angular/core';
import { CompletionChartComponent } from '@features/statistics/ui/completion-chart/completion-chart.component';

@Component({
  selector: 'app-statistics-page',
  imports: [CompletionChartComponent],
  template: `
    <h1>Статистика</h1>
    <app-completion-chart />
  `,
})
export class StatisticsPage {}
