import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface User {
  email: string;
  fullName: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<User | null>(null);

  constructor() {}

  setUser(user: User) {
    this.userSubject.next(user);
  }

  clearUser() {
    this.userSubject.next(null);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getUserObservable(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  hasRole(role: string): boolean {
    return this.getUser()?.roles.includes(role) || false;
  }
}
