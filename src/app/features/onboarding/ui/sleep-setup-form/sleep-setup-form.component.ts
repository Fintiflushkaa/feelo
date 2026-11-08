import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AlarmUsage } from '../../../../../api/models/alarm-usage';
import { DipPreference } from '../../../../../api/models/dip-preference';
import { PeakPreference } from '../../../../../api/models/peak-preference';
import { SurveyAnswerDto } from '../../../../../api/models/survey-answer-dto';
import { SurveyService } from '../../../../../api/services/survey.service';

const peakOptions: { value: PeakPreference; label: string }[] = [
  { value: 'Morning', label: 'Утром' },
  { value: 'AroundNoon', label: 'Около полудня' },
  { value: 'Afternoon', label: 'После полудня' },
  { value: 'Evening', label: 'Вечером' },
  { value: 'Night', label: 'Ночью' },
  { value: 'NoDifference', label: 'Нет разницы' },
];
const timeValidators = [Validators.required, Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)];

@Component({
  selector: 'app-sleep-setup-form',
  imports: [ReactiveFormsModule],
  templateUrl: './sleep-setup-form.component.html',
  styleUrl: './sleep-setup-form.component.scss',
})
export class SleepSetupFormComponent {
  private readonly builder = inject(FormBuilder);
  private readonly survey = inject(SurveyService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  readonly step = signal(0);
  readonly pending = signal(false);
  readonly error = signal('');
  readonly form = this.builder.group({
    workWake: this.builder.nonNullable.control('', timeValidators),
    workSleep: this.builder.nonNullable.control('', timeValidators),
    duration: this.builder.nonNullable.control<number | null>(null, [
      Validators.required,
      Validators.min(0.25),
      Validators.max(24),
    ]),
    restriction: this.builder.control<'yes' | 'no' | null>(null, Validators.required),
    requiredWakeTime: this.builder.nonNullable.control(
      { value: '', disabled: true },
      timeValidators,
    ),
    freeSleep: this.builder.nonNullable.control('', timeValidators),
    freeWake: this.builder.nonNullable.control('', timeValidators),
    alarmUsage: this.builder.control<AlarmUsage | null>(null, Validators.required),
    generalPeak: this.builder.control<PeakPreference | null>(null, Validators.required),
    mentalPeak: this.builder.control<PeakPreference | null>(null, Validators.required),
    physicalPeak: this.builder.control<PeakPreference | null>(null, Validators.required),
    socialPeak: this.builder.control<PeakPreference | null>(null, Validators.required),
    routinePeak: this.builder.control<PeakPreference | null>(null, Validators.required),
    afternoonDip: this.builder.control<DipPreference | null>(null, Validators.required),
  });
  readonly questions: {
    title: string;
    key: keyof SleepSetupFormComponent['form']['controls'];
    kind: 'time' | 'duration' | 'restriction' | 'choice';
    options?: { value: string; label: string }[];
  }[] = [
    { title: 'В какое время вы обычно просыпаетесь по будням?', key: 'workWake', kind: 'time' },
    { title: 'В какое время вы обычно засыпаете по будням?', key: 'workSleep', kind: 'time' },
    {
      title: 'Какой продолжительности сна вы бы хотели достичь (в часах)?',
      key: 'duration',
      kind: 'duration',
    },
    {
      title:
        'Есть ли у вас строгие ограничения по времени пробуждения (утренние дела, расписание работы)?',
      key: 'restriction',
      kind: 'restriction',
      options: [
        { value: 'yes', label: 'Да' },
        { value: 'no', label: 'Нет' },
      ],
    },
    {
      title: 'Если завтра вам не нужно никуда вставать, во сколько вы обычно засыпаете?',
      key: 'freeSleep',
      kind: 'time',
    },
    {
      title: 'В такие дни, когда вам не нужно рано вставать, во сколько вы обычно просыпаетесь?',
      key: 'freeWake',
      kind: 'time',
    },
    {
      title: 'Пользуетесь ли вы будильником в выходные?',
      key: 'alarmUsage',
      kind: 'choice',
      options: [
        { value: 'None', label: 'Не пользуюсь' },
        { value: 'Sometimes', label: 'Иногда' },
        { value: 'Always', label: 'Всегда' },
      ],
    },
    {
      title: 'В какое время суток вы чувствуете наибольший прилив сил?',
      key: 'generalPeak',
      kind: 'choice',
      options: peakOptions,
    },
    {
      title: 'Когда вам легче всего сосредоточиться на умственной работе (учеба, работа)?',
      key: 'mentalPeak',
      kind: 'choice',
      options: peakOptions,
    },
    {
      title: 'Когда вам лучше всего дается спорт или физическая работа?',
      key: 'physicalPeak',
      kind: 'choice',
      options: peakOptions,
    },
    {
      title: 'Когда вам комфортнее всего общаться и встречаться с людьми?',
      key: 'socialPeak',
      kind: 'choice',
      options: peakOptions,
    },
    {
      title: 'Когда вы охотнее всего занимаетесь рутиной (уборка, бытовые дела)?',
      key: 'routinePeak',
      kind: 'choice',
      options: peakOptions,
    },
    {
      title: 'Когда у вас обычно наступает спад сил?',
      key: 'afternoonDip',
      kind: 'choice',
      options: [
        { value: 'From12To14', label: 'С 12:00 до 14:00' },
        { value: 'From14To16', label: 'С 14:00 до 16:00' },
        { value: 'From16To18', label: 'С 16:00 до 18:00' },
        { value: 'After18', label: 'После 18:00' },
        { value: 'NoNoticeableDip', label: 'Не замечаю спада сил' },
      ],
    },
  ];

  constructor() {
    this.form.controls.restriction.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        if (value === 'yes') this.form.controls.requiredWakeTime.enable();
        else this.form.controls.requiredWakeTime.disable();
      });
  }

  get question() {
    return this.questions[this.step()];
  }
  get control() {
    return this.form.controls[this.question.key];
  }

  back(): void {
    if (this.pending() || this.step() === 0) return;
    this.moveTo(this.step() - 1);
  }

  next(): void {
    if (this.pending()) return;
    this.control.markAsTouched();
    if (this.control.invalid) return;
    if (this.question.kind === 'restriction') {
      this.form.controls.requiredWakeTime.markAsTouched();
      if (this.form.controls.requiredWakeTime.invalid) return;
    }
    if (this.step() < this.questions.length - 1) {
      this.moveTo(this.step() + 1);
      return;
    }
    this.submit();
  }

  private moveTo(step: number): void {
    this.step.set(step);
    this.error.set('');
    this.heading()?.nativeElement.focus();
  }

  private submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.moveTo(
        this.questions.findIndex(
          (q) =>
            this.form.controls[q.key].invalid ||
            (q.kind === 'restriction' && this.form.controls.requiredWakeTime.invalid),
        ),
      );
      return;
    }
    const value = this.form.getRawValue();
    if (
      !value.alarmUsage ||
      !value.generalPeak ||
      !value.mentalPeak ||
      !value.physicalPeak ||
      !value.socialPeak ||
      !value.routinePeak ||
      !value.afternoonDip
    )
      return;
    const seconds = Math.round(Number(value.duration) * 3600);
    const clock = [
      Math.floor((seconds % 86400) / 3600),
      Math.floor((seconds % 3600) / 60),
      seconds % 60,
    ]
      .map((part) => String(part).padStart(2, '0'))
      .join(':');
    const duration = seconds >= 86400 ? `${Math.floor(seconds / 86400)}.${clock}` : clock;
    const answers: SurveyAnswerDto = {
      workDaySleepSchedule: {
        sleepStart: `${value.workSleep}:00`,
        wakeTime: `${value.workWake}:00`,
      },
      freeDaySleepSchedule: {
        sleepStart: `${value.freeSleep}:00`,
        wakeTime: `${value.freeWake}:00`,
      },
      desiredSleepDuration: duration,
      requiredWakeTime: value.restriction === 'yes' ? `${value.requiredWakeTime}:00` : null,
      alarmUsage: value.alarmUsage,
      generalPeak: value.generalPeak,
      mentalPeak: value.mentalPeak,
      physicalPeak: value.physicalPeak,
      socialPeak: value.socialPeak,
      routinePeak: value.routinePeak,
      afternoonDip: value.afternoonDip,
    };
    this.error.set('');
    this.pending.set(true);
    this.survey
      .submit(answers)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pending.set(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/home');
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof HttpErrorResponse && [400, 422].includes(error.status)
              ? 'Сервер отклонил ответы. Проверьте данные и попробуйте ещё раз.'
              : 'Не удалось отправить анкету. Проверьте подключение и попробуйте ещё раз.',
          );
        },
      });
  }
}
