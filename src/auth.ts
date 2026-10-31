export type AuthUser = {
  name: string;
  email: string;
};

type StoredUser = AuthUser & {
  // Demo-only local browser authentication. Never store plain-text passwords in production.
  password: string;
};

const USERS_KEY = "finguard_demo_users";
const SESSION_KEY = "finguard_demo_session";

function readUsers(): StoredUser[] {
  try {
    const value = localStorage.getItem(USERS_KEY);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

export function getCurrentUser(): AuthUser | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthUser;
    return parsed?.name && parsed?.email ? parsed : null;
  } catch {
    return null;
  }
}

export function signupUser(name: string, email: string, password: string): AuthUser {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) throw new Error("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Please enter a valid email address.");
  if (password.length < 6) throw new Error("Password must contain at least 6 characters.");

  const users = readUsers();
  if (users.some((user) => user.email.toLowerCase() === cleanEmail)) {
    throw new Error("An account with this email already exists. Please log in.");
  }

  const user: StoredUser = { name: cleanName, email: cleanEmail, password };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const session: AuthUser = { name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function loginUser(email: string, password: string): AuthUser {
  const cleanEmail = email.trim().toLowerCase();
  const user = readUsers().find((entry) => entry.email.toLowerCase() === cleanEmail && entry.password === password);
  if (!user) throw new Error("Email or password is incorrect. If you are new, create an account first.");
  const session: AuthUser = { name: user.name, email: user.email };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logoutUser(): void {
  localStorage.removeItem(SESSION_KEY);
}
