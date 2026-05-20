export interface UserAccount {
  id: string;
  name: string;
  createdAt: number;
  avatarUrl?: string | null;
}

export interface UserCredentials {
  name: string;
  password: string;
}

export interface UserSignUpPayload extends UserCredentials {}

export interface UserSession {
  user: UserAccount;
  token: string; // local opaque token, not a JWT
  issuedAt: number;
}
