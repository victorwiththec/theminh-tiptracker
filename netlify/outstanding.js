const { getClient } = require('./utils');

exports.handler = async (event) => {
  const { httpMethod, body } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM outstanding_balance LIMIT 1');
      return { statusCode: 200, body: JSON.stringify(res.rows[0] || { amount: 0 }) };
    }

    if (httpMethod === 'POST') {
      const { amount, reason } = JSON.parse(body);
      await client.query('UPDATE outstanding_balance SET amount = amount + $1, last_updated = NOW()', [
        amount,
      ]);
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['outstanding_adjusted', `Outstanding adjusted by ${amount} Ft: ${reason}`, 'Admin']
      );
      const res = await client.query('SELECT * FROM outstanding_balance LIMIT 1');
      return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
