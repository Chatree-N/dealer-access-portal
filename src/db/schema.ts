import { pgTable, serial } from 'drizzle-orm/pg-core';

// This is an empty schema for initial setup
export const dummy = pgTable('dummy', {
  id: serial('id').primaryKey(),
});
