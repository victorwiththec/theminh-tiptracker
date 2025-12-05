const { getClient } = require('./utils');

exports.handler = async (event) => {
  const { httpMethod } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      // GET /api/employees - list all employees
      const res = await client.query(
        'SELECT id, name, pin, active, archived, deleted, title, is_waitress, created_at FROM employees ORDER BY name'
      );
      return {
        statusCode: 200,
body: JSON.stringify(res.rows.map(r => ({...r, pin: String(r.pin)}))),      };
    }

    return { statusCode: 405, body: 'Method not allowed' };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
