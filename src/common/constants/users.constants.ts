export type Role = 'admin' | 'supervisor' | 'advisor';

export interface InMemoryUser {
  username: string;
  role: Role;
}

export const USERS: InMemoryUser[] = [
  { username: 'admin01', role: 'admin' },
  { username: 'supervisor01', role: 'supervisor' },
  { username: 'advisor01', role: 'advisor' },
  { username: 'advisor02', role: 'advisor' },
];

export function findUser(username: string): InMemoryUser | undefined {
  return USERS.find((u) => u.username === username);
}
