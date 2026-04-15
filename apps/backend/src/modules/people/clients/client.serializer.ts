import type { Client } from '@prisma/client';

// Dashboard and mobile clients historically use lowercase enum values
// ("male" / "female", "walk_in" / "full"). Prisma emits the raw enum names
// (MALE, WALK_IN). Normalize on the way out so we don't have to touch every UI.
export type SerializedClient = Omit<Client, 'gender' | 'accountType'> & {
  gender: 'male' | 'female' | null;
  accountType: 'full' | 'walk_in';
};

export function serializeClient(client: Client): SerializedClient {
  return {
    ...client,
    gender: client.gender ? (client.gender.toLowerCase() as 'male' | 'female') : null,
    accountType: client.accountType === 'FULL' ? 'full' : 'walk_in',
  };
}
