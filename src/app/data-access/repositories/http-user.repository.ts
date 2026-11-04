import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { User } from '../../shared/models/user';
import { API_BASE_URL } from '../api/api.config';
import { UserDto, toUserDto, toUserWithCredentials } from '../dto/user.dto';
import { UserRepository, UserWithCredentials } from './user.repository';

@Injectable()
export class HttpUserRepository extends UserRepository {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/users`;

  findByEmail(email: string): Observable<UserWithCredentials | null> {
    return this.http
      .get<UserDto[]>(this.url, { params: { email } })
      .pipe(map((users) => (users.length > 0 ? toUserWithCredentials(users[0]) : null)));
  }

  create(record: UserWithCredentials): Observable<UserWithCredentials> {
    return this.http.post<UserDto>(this.url, toUserDto(record)).pipe(map(toUserWithCredentials));
  }

  updateName(id: string, name: string): Observable<User> {
    return this.http
      .patch<UserDto>(`${this.url}/${encodeURIComponent(id)}`, { name })
      .pipe(map((dto) => toUserWithCredentials(dto).user));
  }
}
