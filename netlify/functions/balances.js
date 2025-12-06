const { getClient } = require('./utils');

const SPLIT = {
  waitress: 0.5,
  chef: 0.25,
  prepcook: 0.25,
};

exports.handler = async (event) => {
  const { httpMethod, path } = event;
  let client;

  try {
    client = await getClient();

    // GET /balance/:name
    if (httpMethod === 'GET' && path.includes('/balance/')) {
      const name = decodeURIComponent(path.split('/').pop());
      const balance = await calculateEmployeeBalance(client, name);
      return { statusCode: 200, body: JSON.stringify({ name, balance }) };
    }

    // GET /balances
    if (httpMethod === 'GET') {
      const employees = await client.query(
        'SELECT name FROM employees WHERE deleted = false ORDER BY name'
      );
      const balances = {};

      for (const emp of employees.rows) {
        balances[emp.name] = await calculateEmployeeBalance(client, emp.name);
      }

      return { statusCode: 200, body: JSON.stringify(balances) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (err) {
    console.error('Balances handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (client) await client.end();
  }
};

async function calculateEmployeeBalance(client, name) {
  const employee = await client.query('SELECT * FROM employees WHERE name = $1', [name]);
  if (!employee.rows.length) return 0;

  const emp = employee.rows[0];
  let balance = 0;

  if (emp.is_waitress) {
    // Waitress: 50% of tips they personally served
    const tipsRes = await client.query(
      'SELECT SUM(amount) as total FROM tips WHERE waitress_name = $1 AND paid = false',
      [name]
    );
    balance += Math.floor((tipsRes.rows[0].total || 0) * SPLIT.waitress);
  } else if (emp.title === 'Chef') {
    // Chef: 25% of ALL unpaid tips
    const tipsRes = await client.query(
      'SELECT SUM(amount) as total FROM tips WHERE paid = false'
    );
    balance += Math.floor((tipsRes.rows[0].total || 0) * SPLIT.chef);
  } else if (emp.title === 'Prepcook') {
    // Prepcook: 25% of ALL unpaid tips
    const tipsRes = await client.query(
      'SELECT SUM(amount) as total FROM tips WHERE paid = false'
    );
    balance += Math.floor((tipsRes.rows[0].total || 0) * SPLIT.prepcook);
  }

  // Subtract completed and pending payouts
  const payoutsRes = await client.query(
    'SELECT SUM(amount) as total FROM payouts WHERE employee_name = $1 AND status IN ($2, $3)',
    [name, 'completed', 'pending']
  );
  balance -= payoutsRes.rows[0].total || 0;

  return Math.max(0, balance);
}
