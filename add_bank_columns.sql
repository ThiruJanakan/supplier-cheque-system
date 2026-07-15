-- SQL Migration: Add detailed bank fields to suppliers and cheques tables
-- Run this script in the Supabase SQL Editor

-- 1. Update suppliers table
alter table suppliers add column if not exists bank_account_no text;
alter table suppliers add column if not exists branch_name text;
alter table suppliers add column if not exists branch_code text;

-- 2. Update cheques table
alter table cheques add column if not exists bank_account_no text;
alter table cheques add column if not exists branch_name text;
alter table cheques add column if not exists branch_code text;
