const { getClient } = require('./utils');

const CARD_FEE_PCT = 0.05;

exports.handler = async (event) => {
  const { httpMethod, path, body } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM tips ORDER BY date DESC');
      return { statusCode: 200, body: JSON.stringify(res.rows) };
    }

    if (httpMethod === 'POST' && !path.includes('/')) {
      const { waitress_name, amount, method, date, notes } = JSON.parse(body);

      let finalAmount = amount;
      if (method === 'card') {
        finalAmount = Math.floor(amount * (1 - CARD_FEE_PCT));
      }

      const tipRes = await client.query(
        'INSERT INTO tips (waitress_name, amount, method, date, notes, paid) VALUES ($1, $2, $3, $4, $5, false) RETURNING *',
        [waitress_name, finalAmount, method, date, notes || null]
      );

      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['tip_recorded', `Tip: ${waitress_name}, ${finalAmount} Ft (${method}), ${date}`, 'Admin']
      );

      return { statusCode: 201, body: JSON.stringify(tipRes.rows[0]) };
    }

    if (httpMethod === 'PUT') {
      const id = path.split('/').pop();
      const { waitress_name, amount, method, date, notes } = JSON.parse(body);

      let finalAmount = amount;
      if (method === 'card') {
        finalAmount = Math.floor(amount * (1 - CARD_FEE_PCT));
      }

      const oldTip = await client.query('SELECT * FROM tips WHERE id = $1', [id]);
      await client.query(
        'UPDATE tips SET waitress_name = $1, amount = $2, method = $3, date = $4, notes = $5 WHERE id = $6',
        [waitress_name, finalAmount, method, date, notes, id]
      );

      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        [
          'tip_modified',
          `Tip ${id}: ${oldTip.rows[0].amount} → ${finalAmount} Ft, ${oldTip.rows[0].waitress_name} → ${waitress_name}`,
          'Admin',
        ]
      );

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (httpMethod === 'DELETE') {
      const id = path.split('/').pop();
      const tip = await client.query('SELECT * FROM tips WHERE id = $1', [id]);

      await client.query('DELETE FROM tips WHERE id = $1', [id]);
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['tip_deleted', `Tip ${id}: ${tip.rows[0].amount} Ft, ${tip.rows[0].waitress_name}`, 'Admin']
      );

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.errorconsole.log('Tips INSERT Error:', err, 'Params:', [waitress_name, finalAmount, method, date, notes]);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
