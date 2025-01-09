import { UserRole } from '@prisma/client';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      email: string;
      image?: string;
      name?: string;
    };
  }

  interface User {
    id: string;
    role: UserRole;
  }
} 