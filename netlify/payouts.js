const { getClient } = require('./utils');

exports.handler = async (event) => {
  const { httpMethod, path, body } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM payouts ORDER BY date DESC');
      return { statusCode: 200, body: JSON.stringify(res.rows) };
    }

    if (httpMethod === 'POST' && !path.includes('/cancel')) {
      const { employee_name, amount, date, status, notes } = JSON.parse(body);
      const res = await client.query(
        'INSERT INTO payouts (employee_name, amount, date, status, notes, modified_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [employee_name, amount, date, status || 'completed', notes, 'Admin']
      );
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['payout_recorded', `Payout: ${employee_name}, ${amount} Ft`, 'Admin']
      );
      return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
    }

    if (httpMethod === 'PUT') {
      const id = path.split('/').pop();
      const { employee_name, amount, date, status, notes } = JSON.parse(body);
      const oldPayout = await client.query('SELECT * FROM payouts WHERE id = $1', [id]);

      await client.query(
        'UPDATE payouts SET employee_name = $1, amount = $2, date = $3, status = $4, notes = $5, modified_date = NOW() WHERE id = $6',
        [employee_name, amount, date, status, notes, id]
      );

      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['payout_modified', `Payout ${id}: ${oldPayout.rows[0].amount} → ${amount} Ft`, 'Admin']
      );
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (httpMethod === 'POST' && path.includes('/cancel')) {
      const id = path.split('/')[4];
      const payout = await client.query('SELECT * FROM payouts WHERE id = $1', [id]);

      await client.query('UPDATE payouts SET status = $1, modified_date = NOW() WHERE id = $2', [
        'cancelled',
        id,
      ]);
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        [
          'payout_cancelled',
          `Payout ${id} cancelled: ${payout.rows[0].employee_name}, ${payout.rows[0].amount} Ft returned`,
          'Admin',
        ]
      );
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
