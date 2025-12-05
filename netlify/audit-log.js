const { getClient } = require('./utils');

exports.handler = async (event) => {
  const { httpMethod, queryStringParameters } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      const limit = (queryStringParameters?.limit) || 100;
      const res = await client.query(
        'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1',
        [limit]
      );
      return { statusCode: 200, body: JSON.stringify(res.rows) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    await client.end();
  }
};
