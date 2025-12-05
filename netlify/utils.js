const { Client } = require('pg');

async function getClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

function formatDate(date) {
  return new Date(date).toISOString().split('T')[0];
}

module.exports = { getClient, formatDate };
