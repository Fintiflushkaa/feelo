import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api-url';
import { UpdateTaskDto, TaskDto, TaskDtoTaskSyncResult } from '../models/index';

@Injectable({
  providedIn: 'root',
})
export class TasksService {
  http = inject(HttpClient);

  get() {
    return this.http.get<TaskDto[]>(`${API_URL}/tasks`);
  }

  create(dto: TaskDto) {
    return this.http.post<TaskDtoTaskSyncResult>(`${API_URL}/tasks/create`, dto);
  }

  update(taskId: string, dto: UpdateTaskDto) {
    return this.http.put<TaskDtoTaskSyncResult>(`${API_URL}/tasks/${taskId}`, dto);
  }

  delete(taskId: string) {
    return this.http.delete<void>(`${API_URL}/tasks/${taskId}`);
  }
}
