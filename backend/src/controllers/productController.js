// Criar Produto com Variações (Apenas Admin)
app.post('/api/admin/products', authorize(['admin']), async (req, res) => {
  const { name, description, base_price, variations } = req.body;
  // variations = [{ sku, color, size, stock, price_adjustment }]

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insere o produto base
    const [prodResult] = await connection.query(
      'INSERT INTO products (name, description, base_price) VALUES (?, ?, ?)',
      [name, description, base_price]
    );
    const productId = prodResult.insertId;

    // 2. Insere todas as variações associadas
    if (variations && variations.length > 0) {
      const varValues = variations.map(v => [
        productId, v.sku, v.color, v.size, v.stock, v.price_adjustment || 0
      ]);

      await connection.query(
        'INSERT INTO product_variations (product_id, sku, color, size, stock, price_adjustment) VALUES ?',
        [varValues]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Produto e variações cadastrados!', productId });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: 'Erro ao cadastrar produto', details: err.message });
  } finally {
    connection.release();
  }
});
app.get('/api/products', async (req, res) => {
  try {
    // Busca produtos e faz um JOIN com as variações para trazer tudo agrupado
    const [rows] = await pool.query(`
      SELECT p.*, 
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id', v.id, 'sku', v.sku, 'color', v.color, 
                 'size', v.size, 'stock', v.stock, 'adj', v.price_adjustment
               )
             ) as variations
      FROM products p
      LEFT JOIN product_variations v ON p.id = v.product_id
      WHERE p.active = TRUE
      GROUP BY p.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar catálogo' });
  }
});
app.get('/api/products', async (req, res) => {
  try {
    // Busca produtos e faz um JOIN com as variações para trazer tudo agrupado
    const [rows] = await pool.query(`
      SELECT p.*, 
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id', v.id, 'sku', v.sku, 'color', v.color, 
                 'size', v.size, 'stock', v.stock, 'adj', v.price_adjustment
               )
             ) as variations
      FROM products p
      LEFT JOIN product_variations v ON p.id = v.product_id
      WHERE p.active = TRUE
      GROUP BY p.id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar catálogo' });
  }
});