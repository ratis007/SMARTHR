const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

process.env.DB_NAME = process.env.PAYROLL_API_TEST_DB_NAME || 'smarthr_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

require('ts-node/register');
require('../src/main.ts');
