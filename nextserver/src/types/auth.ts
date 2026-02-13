import { Profile } from "@/types/profile";
import type { Address } from "@/types/address";

// Re-export for convenience
export type { Profile };

// User type with relations
export type User = Profile & {
  addresses: Address[] | null;
};
