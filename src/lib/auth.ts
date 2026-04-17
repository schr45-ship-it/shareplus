import type { User } from "firebase/auth";

export async function getIdToken(user: User): Promise<string> {
  return await user.getIdToken();
}
