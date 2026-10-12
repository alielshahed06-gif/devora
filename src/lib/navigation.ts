export interface NavigationUser {
  role: string;
}

export function navigationVisibility(user: NavigationUser | null | undefined) {
  return {
    showLogin: user === null,
    showAdmin: user?.role === 'ADMIN' || user?.role === 'STAFF',
  };
}
