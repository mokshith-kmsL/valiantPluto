#!/usr/bin/env node
/**
 * scripts/migrate.js
 * Minimal migration runner — applies SQL files in order from /migrations.
 * Usage:
 *   node scripts/migrate.js          → run all pending migrations
 *   node scripts/migrate.js --down   → drop all tables (dev reset only)
 */

'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    // Track applied migrations in a simple control table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename  TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const dir   = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1', [file]
      );
      if (rows.length > 0) {
        console.log(`  [skip]    ${file}`);
        continue;
      }

      console.log(`  [apply]   ${file}`);
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (filename) VALUES ($1)', [file]
      );
      console.log(`  [done]    ${file}`);
    }

    console.log('\nMigrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrateDown() {
  console.warn('⚠  Running DOWN migration — this drops all StockSense tables!');
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS ledger_entries CASCADE;
      DROP TABLE IF EXISTS products      CASCADE;
      DROP TABLE IF EXISTS locations     CASCADE;
      DROP TABLE IF EXISTS _migrations   CASCADE;
      DROP TYPE  IF EXISTS operation_type_enum CASCADE;
      DROP TYPE  IF EXISTS entry_status_enum   CASCADE;
    `);
    console.log('All tables dropped.');
  } finally {
    client.release();
    await pool.end();
  }
}

const isDown = process.argv.includes('--down');
(isDown ? migrateDown() : migrate()).catch(console.error);
