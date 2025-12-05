const { getClient } = require('./utils');

exports.handler = async (event) => {
  const { httpMethod, path, body } = event;
  const client = await getClient();

  try {
    if (httpMethod === 'GET') {
      const res = await client.query(
        'SELECT id, name, pin, active, archived, deleted, title, is_waitress, created_at FROM employees ORDER BY name'
      );
      return {
        statusCode: 200,
        body: JSON.stringify(res.rows),
      };
    }

    if (httpMethod === 'POST' && !path.includes('/archive') && !path.includes('/delete')) {
      const { name, pin, title, is_waitress } = JSON.parse(body);
      const res = await client.query(
        'INSERT INTO employees (name, pin, title, is_waitress) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, pin, title || null, is_waitress || false]
      );
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        ['employee_added', `Employee ${name} added`, 'Admin']
      );
      return { statusCode: 201, body: JSON.stringify(res.rows[0]) };
    }

    if (httpMethod === 'PUT') {
      const id = path.split('/').pop();
      const { name, title, active, archived } = JSON.parse(body);
      await client.query(
        'UPDATE employees SET name = $1, title = $2, active = $3, archived = $4 WHERE id = $5',
        [name, title, active, archived, id]
      );
      const res = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
    }

    if (httpMethod === 'POST' && path.includes('/archive')) {
      const id = path.split('/')[4];
      const { archived } = JSON.parse(body);
      await client.query('UPDATE employees SET archived = $1 WHERE id = $2', [archived, id]);
      const res = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      const status = archived ? 'archived' : 'unarchived';
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        [`employee_${status}`, `Employee ${res.rows[0].name} ${status}`, 'Admin']
      );
      return { statusCode: 200, body: JSON.stringify(res.rows[0]) };
    }

    if (httpMethod === 'POST' && path.includes('/delete')) {
      const id = path.split('/')[4];
      const { transfer_to, transfer_amount } = JSON.parse(body);
      const emp = await client.query('SELECT * FROM employees WHERE id = $1', [id]);
      const empName = emp.rows[0].name;

      if (transfer_to === 'outstanding') {
        await client.query(
          'UPDATE outstanding_balance SET amount = amount + $1, last_updated = NOW()',
          [transfer_amount]
        );
      }

      await client.query('UPDATE employees SET deleted = true, deleted_date = NOW() WHERE id = $1', [id]);
      await client.query(
        'INSERT INTO audit_log (action, details, "user") VALUES ($1, $2, $3)',
        [
          'employee_deleted',
          `Employee ${empName} deleted. Transfer: ${transfer_amount} Ft to ${transfer_to}`,
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
