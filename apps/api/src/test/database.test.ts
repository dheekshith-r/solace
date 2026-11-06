import { afterEach, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from './database';

// Fake URLs only. The real ones are put back after each test.
const saved = {
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  MIGRATION_DATABASE_URL: process.env.MIGRATION_DATABASE_URL,
};

function setEnv(values: Partial<Record<keyof typeof saved, string>>) {
  for (const name of Object.keys(saved) as (keyof typeof saved)[]) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
}

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

const pooler = 'aws-0-ap-south-1.pooler.supabase.com';

describe('testDatabaseUrl guard', () => {
  it('accepts a different project on the same pooler host', () => {
    setEnv({
      TEST_DATABASE_URL: `postgresql://postgres.testref:pw1@${pooler}:6543/postgres`,
      DATABASE_URL: `postgresql://postgres.realref:pw2@${pooler}:6543/postgres`,
    });
    expect(testDatabaseUrl()).toContain('testref');
  });

  it('refuses the same host, user and database even when port, password or query differ', () => {
    for (const real of [
      `postgresql://postgres.realref:other@${pooler}:5432/postgres`,
      `postgresql://postgres.realref:pw@${pooler.toUpperCase()}:6543/postgres?sslmode=require`,
      `postgres://postgres.realref:pw@${pooler}/postgres`,
    ]) {
      setEnv({
        TEST_DATABASE_URL: `postgresql://postgres.realref:pw@${pooler}:6543/postgres`,
        DATABASE_URL: real,
      });
      expect(() => testDatabaseUrl()).toThrow(/same database as DATABASE_URL/);
    }
  });

  it('also refuses the migration database', () => {
    setEnv({
      TEST_DATABASE_URL: `postgresql://postgres.realref:pw@${pooler}:6543/postgres`,
      MIGRATION_DATABASE_URL: `postgresql://postgres.realref:pw@${pooler}:5432/postgres`,
    });
    expect(() => testDatabaseUrl()).toThrow(/MIGRATION_DATABASE_URL/);
  });

  it('refuses a missing or malformed URL without echoing it', () => {
    setEnv({});
    expect(() => testDatabaseUrl()).toThrow(/not set/);
    setEnv({ TEST_DATABASE_URL: 'not a url secret-pw' });
    expect(() => testDatabaseUrl()).toThrow(/not a valid URL/);
    try {
      testDatabaseUrl();
    } catch (error) {
      expect(String(error)).not.toContain('secret-pw');
    }
  });
});
