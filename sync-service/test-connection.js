/**
 * Test Connection Script
 *
 * Tests connections to both SQL Server and Supabase
 */

import sql from 'mssql';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function testSqlServer() {
  console.log('Testing SQL Server connection...');
  console.log(`  Server: ${process.env.MSSQL_SERVER}`);
  console.log(`  Database: ${process.env.MSSQL_DATABASE}`);

  try {
    const pool = await sql.connect({
      server: process.env.MSSQL_SERVER,
      database: process.env.MSSQL_DATABASE,
      user: process.env.MSSQL_USERNAME,
      password: process.env.MSSQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    });

    // Test query
    const result = await pool.request().query(`
      SELECT TOP 5
        recording_id,
        call_timestamp,
        agent_email,
        campaign,
        length_seconds
      FROM fivenine.call_recording_logs
      ORDER BY call_timestamp DESC
    `);

    console.log('  SUCCESS! Connected to SQL Server');
    console.log(`  Sample data (${result.recordset.length} rows):`);
    result.recordset.forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.agent_email} - ${row.campaign} (${row.length_seconds}s)`);
    });

    await pool.close();
    return true;
  } catch (error) {
    console.error('  FAILED:', error.message);
    return false;
  }
}

async function testSupabase() {
  console.log('\nTesting Supabase connection...');
  console.log(`  URL: ${process.env.SUPABASE_URL}`);

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Test query - use service role which bypasses RLS
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .limit(5);

    if (error) {
      console.error('  Query error:', error);

      // Try a simpler test - just check if we can reach Supabase
      console.log('  Trying health check...');
      const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });

      if (response.ok) {
        console.log('  Supabase is reachable, but profiles table query failed');
        console.log('  This may be normal if migrations haven\'t been run yet');
        return true;
      }
      throw error;
    }

    console.log('  SUCCESS! Connected to Supabase');
    console.log(`  Sample profiles (${data.length} rows):`);
    data.forEach((row, i) => {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email;
      console.log(`    ${i + 1}. ${name}`);
    });

    return true;
  } catch (error) {
    console.error('  FAILED:', error.message);
    return false;
  }
}

async function testTranscriptFetch() {
  console.log('\nTesting transcript URL access...');

  // Get a sample transcript URL from SQL Server
  try {
    const pool = await sql.connect({
      server: process.env.MSSQL_SERVER,
      database: process.env.MSSQL_DATABASE,
      user: process.env.MSSQL_USERNAME,
      password: process.env.MSSQL_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    });

    const result = await pool.request().query(`
      SELECT TOP 1
        call_id,
        agent_email,
        file_path,
        CASE
          WHEN server_name = 'F9' AND call_id IS NOT NULL THEN
            CONCAT(
              'https://nas01.tlcops.com/Five9VmBackup/',
              REPLACE(file_path, 'recordings', 'transcripts'),
              call_id,
              '_',
              agent_email,
              '_transcript.txt'
            )
          ELSE ''
        END AS transcript_link
      FROM fivenine.call_recording_logs
      WHERE server_name = 'F9' AND call_id IS NOT NULL
      ORDER BY call_timestamp DESC
    `);

    await pool.close();

    if (result.recordset.length === 0 || !result.recordset[0].transcript_link) {
      console.log('  No transcript URL found to test');
      return null;
    }

    const url = result.recordset[0].transcript_link;
    console.log(`  Testing URL: ${url}`);

    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      console.log(`  SUCCESS! Fetched ${text.length} characters`);
      console.log(`  Preview: ${text.substring(0, 200)}...`);
      return true;
    } else {
      console.log(`  FAILED: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('  FAILED:', error.message);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Connection Test');
  console.log('='.repeat(60));

  const sqlOk = await testSqlServer();
  const supabaseOk = await testSupabase();
  const transcriptOk = await testTranscriptFetch();

  console.log('\n' + '='.repeat(60));
  console.log('Results:');
  console.log(`  SQL Server: ${sqlOk ? 'OK' : 'FAILED'}`);
  console.log(`  Supabase: ${supabaseOk ? 'OK' : 'FAILED'}`);
  console.log(`  Transcripts: ${transcriptOk === null ? 'N/A' : transcriptOk ? 'OK' : 'FAILED'}`);
  console.log('='.repeat(60));

  if (sqlOk && supabaseOk) {
    console.log('\nAll connections successful! Ready to sync.');
  } else {
    console.log('\nSome connections failed. Please check your .env configuration.');
  }
}

main().catch(console.error);
