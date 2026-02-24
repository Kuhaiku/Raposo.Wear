import jwt from 'jsonwebtoken';

export const authorize = (roles = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Acesso negado' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Se a rota exige um papel específico (ex: admin) e o usuário não tem
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Proibido: Nível de acesso insuficiente' });
      }

      next();
    } catch (err) {
      res.status(400).json({ error: 'Token inválido' });
    }
  };
};