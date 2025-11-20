# Supabase

This file aims to explain directory structure.

## Schemas

Files in this directory are processed lexicographically, according to the directions in the
config.toml file. To make sorting easier, files are named like so: {number}-{database object
class}-{object name}.sql. The number allows for fine grained sorting between objects of a like
class. For example, to allow for creating a table before its dependents so that the migration
doesn't tell you a table doesn't exist because it sorts lower.

The numbers in brackets shows the range of the possible numeric prefix, the rest of the
label is literal.

[00-09]-type: custom data type, created with CREATE TYPE
[10-19]: RESERVED FOR FUTURE USE
[20-29]-table: tables and their indexes
[30-39]-function: functions and stored procedures
[40-49]-trigger: table triggers
[50-59]: RESERVED FOR FUTURE USE
[60-69]-policy: row level security policies
[70-99]: RESERVED FOR FUTURE USE

## Seeds

Files in this directory are processed lexicographically, according to the directions in the
config.toml file. Seeds the database with data to be added when `db reset` is run.

## Migrations

Stores the actual migration scripts. Easiest way to create a new migration script is to update the
schema files, stop the cluster, run `db diff -f {migration name}`, and then verify the script
output manually and with `db reset` to make sure it applies cleanly.
