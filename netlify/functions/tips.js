const { getClient } = require('./utils');

const CARD_FEE_PCT = 0.05;

exports.handler = async (event) => {
  const { httpMethod, path, body } = event;
  let client;

  try {
    client = await getClient();

    // GET /tips
    if (httpMethod === 'GET') {
      const res = await client.query('SELECT * FROM tips ORDER BY date DESC');
      return {
        statusCode: 200,
        body: JSON.stringify(res.rows),
      };
    }

    // POST /tips
    if (httpMethod === 'POST') {
      const { waitress_name, amount, method, date, notes } = JSON.parse(body);
      let finalAmount = parseInt(amount);
      if (method === 'card') {
        finalAmount = Math.floor(finalAmount * (1 - CARD_FEE_PCT));
      }

      const tipRes = await client.query(
        'INSERT INTO tips (waitress_name, amount, method, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [waitress_name, finalAmount, method, date, notes || null]
      );

      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['tip_recorded', `Tip: ${waitress_name}, ${finalAmount} Ft (${method}), ${date}`, 'Admin']
      );

      return { statusCode: 201, body: JSON.stringify(tipRes.rows[0]) };
    }

    // PUT /tips/:id
    if (httpMethod === 'PUT') {
      const pathParts = path.split('/');
      const id = pathParts[pathParts.length - 1];
      const { waitress_name, amount, method, date, notes } = JSON.parse(body);
      let finalAmount = parseInt(amount);
      if (method === 'card') {
        finalAmount = Math.floor(finalAmount * (1 - CARD_FEE_PCT));
      }

      const oldTip = await client.query('SELECT * FROM tips WHERE id = $1', [id]);
      await client.query(
        'UPDATE tips SET waitress_name = $1, amount = $2, method = $3, date = $4, notes = $5 WHERE id = $6',
        [waitress_name, finalAmount, method, date, notes, id]
      );

      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['tip_modified', `Tip ${id}: ${oldTip.rows[0].amount} → ${finalAmount} Ft`, 'Admin']
      );

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    // DELETE /tips/:id
    if (httpMethod === 'DELETE') {
      const pathParts = path.split('/');
      const id = pathParts[pathParts.length - 1];
      const tip = await client.query('SELECT * FROM tips WHERE id = $1', [id]);

      await client.query('DELETE FROM tips WHERE id = $1', [id]);
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['tip_deleted', `Tip ${id}: ${tip.rows[0].amount} Ft`, 'Admin']
      );

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Tips handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (client) await client.end();
  }
};
